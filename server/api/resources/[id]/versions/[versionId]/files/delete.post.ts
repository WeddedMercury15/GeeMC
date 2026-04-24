import { and, eq, inArray } from 'drizzle-orm'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { resourceVersionFiles } from '../../../../../../database/schema'
import { useDb } from '../../../../../../utils/db'
import { requireGeemcPublish } from '../../../../../../utils/requireGeemcPublish'
import { assertCanManageVersionFiles } from '../../../../../../utils/resourceFilePermissions'

const payloadSchema = z.object({
  id: z.number().int().positive().optional(),
  ids: z.array(z.number().int().positive()).optional()
})

export default defineEventHandler(async (event) => {
  const user = await requireGeemcPublish(event)
  const resourceId = getRouterParam(event, 'id')
  const versionIdRaw = getRouterParam(event, 'versionId')
  const versionId = Number(versionIdRaw)
  if (!resourceId || !Number.isFinite(versionId) || versionId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  }

  const parsed = payloadSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  const ids = parsed.data.ids ?? (parsed.data.id ? [parsed.data.id] : [])
  if (!ids || ids.length === 0) throw createError({ statusCode: 400, statusMessage: 'Missing id(s)' })

  const db = await useDb()
  await assertCanManageVersionFiles({ db, resourceId, versionId, userId: Number(user.id) })

  const rows = await db
    .select({ id: resourceVersionFiles.id, storagePath: resourceVersionFiles.storagePath })
    .from(resourceVersionFiles)
    .where(and(
      eq(resourceVersionFiles.resourceId, resourceId),
      eq(resourceVersionFiles.versionId, versionId),
      inArray(resourceVersionFiles.id, ids)
    ))

  if (rows.length > 0) {
    const deletedIds = new Set(rows.map(r => Number(r.id)))
    const deletedPrimaryRows = await db
      .select({ id: resourceVersionFiles.id })
      .from(resourceVersionFiles)
      .where(and(
        eq(resourceVersionFiles.resourceId, resourceId),
        eq(resourceVersionFiles.versionId, versionId),
        eq(resourceVersionFiles.isPrimary, true),
        inArray(resourceVersionFiles.id, Array.from(deletedIds))
      ))

    for (const r of rows) {
      const abs = path.join(process.cwd(), r.storagePath)
      await unlink(abs).catch(() => {})
    }
    await db
      .delete(resourceVersionFiles)
      .where(and(
        eq(resourceVersionFiles.resourceId, resourceId),
        eq(resourceVersionFiles.versionId, versionId),
        inArray(resourceVersionFiles.id, ids)
      ))

    const remainingRows = await db
      .select({ id: resourceVersionFiles.id, isPrimary: resourceVersionFiles.isPrimary })
      .from(resourceVersionFiles)
      .where(and(
        eq(resourceVersionFiles.resourceId, resourceId),
        eq(resourceVersionFiles.versionId, versionId)
      ))
      .orderBy(resourceVersionFiles.sortOrder, resourceVersionFiles.id)

    // Normalize sort order to avoid gaps after deletes.
    for (let i = 0; i < remainingRows.length; i++) {
      const row = remainingRows[i]
      if (!row) continue
      const rid = Number(row.id)
      if (!Number.isFinite(rid) || rid <= 0) continue
      await db
        .update(resourceVersionFiles)
        .set({ sortOrder: i })
        .where(eq(resourceVersionFiles.id, rid))
    }

    const hasPrimary = remainingRows.some(r => Boolean(r.isPrimary))
    if (remainingRows.length > 0 && (deletedPrimaryRows.length > 0 || !hasPrimary)) {
      const firstRow = remainingRows[0]
      if (!firstRow) return { success: true, deleted: rows.length }
      const firstId = Number(firstRow.id)
      if (!Number.isFinite(firstId) || firstId <= 0) return { success: true, deleted: rows.length }
      await db
        .update(resourceVersionFiles)
        .set({ isPrimary: false })
        .where(and(
          eq(resourceVersionFiles.resourceId, resourceId),
          eq(resourceVersionFiles.versionId, versionId)
        ))
      await db
        .update(resourceVersionFiles)
        .set({ isPrimary: true })
        .where(eq(resourceVersionFiles.id, firstId))
    }
  }

  return { success: true, deleted: rows.length }
})

