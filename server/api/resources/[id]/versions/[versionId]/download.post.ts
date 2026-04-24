import { and, desc, eq, sql } from 'drizzle-orm'
import { resourceVersionFiles, resourceVersions, resources } from '../../../../../database/schema'
import { useDb } from '../../../../../utils/db'
import { assertCanReadResource } from '../../../../../utils/resourceReadPermissions'

export default defineEventHandler(async (event) => {
  const resourceId = getRouterParam(event, 'id')
  const versionIdRaw = getRouterParam(event, 'versionId')
  const versionId = Number(versionIdRaw)
  if (!resourceId || !Number.isFinite(versionId) || versionId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  }

  const db = await useDb()
  await assertCanReadResource({ db, event, resourceId })

  const [row] = await db
    .select({ id: resourceVersions.id })
    .from(resourceVersions)
    .where(and(eq(resourceVersions.id, versionId), eq(resourceVersions.resourceId, resourceId)))
    .limit(1)

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Version not found' })
  }

  await db
    .update(resourceVersions)
    .set({ downloadsCount: sql`${resourceVersions.downloadsCount} + 1` })
    .where(eq(resourceVersions.id, versionId))

  await db
    .update(resources)
    .set({ downloadsCount: sql`${resources.downloadsCount} + 1` })
    .where(eq(resources.id, resourceId))

  const [fileRow] = await db
    .select({ publicUrl: resourceVersionFiles.publicUrl })
    .from(resourceVersionFiles)
    .where(and(eq(resourceVersionFiles.resourceId, resourceId), eq(resourceVersionFiles.versionId, versionId)))
    .orderBy(desc(resourceVersionFiles.isPrimary), resourceVersionFiles.sortOrder, desc(resourceVersionFiles.id))
    .limit(1)

  if (!fileRow?.publicUrl) {
    throw createError({ statusCode: 404, statusMessage: 'No downloadable file for this version' })
  }

  return { success: true, url: fileRow.publicUrl }
})

