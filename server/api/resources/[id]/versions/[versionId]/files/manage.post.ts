import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { resourceVersionFiles } from '../../../../../../database/schema'
import { useDb } from '../../../../../../utils/db'
import { requireGeemcPublish } from '../../../../../../utils/requireGeemcPublish'
import { assertCanManageVersionFiles } from '../../../../../../utils/resourceFilePermissions'

const payloadSchema = z.object({
  action: z.enum(['rename', 'set_primary', 'reorder']),
  fileId: z.number().int().positive().optional(),
  displayName: z.string().min(1).max(255).optional(),
  orderedIds: z.array(z.number().int().positive()).optional()
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
  const p = parsed.data

  const db = await useDb()
  await assertCanManageVersionFiles({ db, resourceId, versionId, userId: Number(user.id) })

  if (p.action === 'rename') {
    if (!p.fileId || !p.displayName) throw createError({ statusCode: 400, statusMessage: 'Missing fields' })
    await db
      .update(resourceVersionFiles)
      .set({ displayName: p.displayName })
      .where(and(
        eq(resourceVersionFiles.id, p.fileId),
        eq(resourceVersionFiles.resourceId, resourceId),
        eq(resourceVersionFiles.versionId, versionId)
      ))
    return { success: true }
  }

  if (p.action === 'set_primary') {
    if (!p.fileId) throw createError({ statusCode: 400, statusMessage: 'Missing fileId' })
    const rows = await db
      .select({ id: resourceVersionFiles.id })
      .from(resourceVersionFiles)
      .where(and(
        eq(resourceVersionFiles.resourceId, resourceId),
        eq(resourceVersionFiles.versionId, versionId)
      ))
      .orderBy(resourceVersionFiles.sortOrder, resourceVersionFiles.id)
    const ids = rows.map(r => Number(r.id))
    const targetId = Number(p.fileId)
    if (!ids.includes(targetId)) {
      throw createError({ statusCode: 404, statusMessage: 'File not found' })
    }
    const reordered = [targetId, ...ids.filter(id => id !== targetId)]
    await db
      .update(resourceVersionFiles)
      .set({ isPrimary: false })
      .where(and(eq(resourceVersionFiles.resourceId, resourceId), eq(resourceVersionFiles.versionId, versionId)))
    for (let i = 0; i < reordered.length; i++) {
      const rid = Number(reordered[i])
      if (!Number.isFinite(rid) || rid <= 0) continue
      await db
        .update(resourceVersionFiles)
        .set({ sortOrder: i, isPrimary: i === 0 })
        .where(eq(resourceVersionFiles.id, rid))
    }
    return { success: true }
  }

  // reorder
  const orderedIds = p.orderedIds ?? []
  if (orderedIds.length === 0) throw createError({ statusCode: 400, statusMessage: 'Missing orderedIds' })

  const rows = await db
    .select({ id: resourceVersionFiles.id })
    .from(resourceVersionFiles)
    .where(and(
      eq(resourceVersionFiles.resourceId, resourceId),
      eq(resourceVersionFiles.versionId, versionId),
      inArray(resourceVersionFiles.id, orderedIds)
    ))
  const valid = new Set(rows.map(r => Number(r.id)))
  const filtered = orderedIds.filter(id => valid.has(Number(id)))
  for (let i = 0; i < filtered.length; i++) {
    const targetId = Number(filtered[i])
    if (!Number.isFinite(targetId) || targetId <= 0) continue
    await db
      .update(resourceVersionFiles)
      .set({ sortOrder: i })
      .where(eq(resourceVersionFiles.id, targetId))
  }
  // Keep primary aligned to first file in the ordered list.
  if (filtered.length > 0) {
    const firstId = Number(filtered[0])
    if (Number.isFinite(firstId) && firstId > 0) {
      await db
        .update(resourceVersionFiles)
        .set({ isPrimary: false })
        .where(and(eq(resourceVersionFiles.resourceId, resourceId), eq(resourceVersionFiles.versionId, versionId)))
      await db
        .update(resourceVersionFiles)
        .set({ isPrimary: true })
        .where(and(
          eq(resourceVersionFiles.id, firstId),
          eq(resourceVersionFiles.resourceId, resourceId),
          eq(resourceVersionFiles.versionId, versionId)
        ))
    }
  }
  return { success: true }
})

