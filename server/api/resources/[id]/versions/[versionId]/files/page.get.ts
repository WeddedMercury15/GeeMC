import { and, desc, eq } from 'drizzle-orm'
import { resourceVersionFiles, resourceVersions, resources } from '../../../../../../database/schema'
import { useDb } from '../../../../../../utils/db'
import { requireGeemcPublish } from '../../../../../../utils/requireGeemcPublish'
import { canManageResourceByTeam } from '../../../../../../utils/resourceTeam'

export default defineEventHandler(async (event) => {
  const user = await requireGeemcPublish(event)
  const resourceId = getRouterParam(event, 'id')
  const versionIdRaw = getRouterParam(event, 'versionId')
  const versionId = Number(versionIdRaw)
  if (!resourceId || !Number.isFinite(versionId) || versionId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid input',
      data: {
        code: 'VALIDATION_ERROR',
        details: [
          { path: 'params.id', message: resourceId ? '' : 'Required' },
          { path: 'params.versionId', message: Number.isFinite(versionId) && versionId > 0 ? '' : 'Expected positive number' }
        ].filter(item => item.message)
      }
    })
  }

  const db = await useDb()
  const [resRow] = await db
    .select({ authorUserId: resources.authorUserId, teamMemberUserIds: resources.teamMemberUserIds })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)
  if (!resRow) throw createError({ statusCode: 404, statusMessage: 'Resource not found' })
  if (!canManageResourceByTeam({ authorUserId: resRow.authorUserId, teamMemberUserIds: resRow.teamMemberUserIds, userId: user.id })) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const [verRow] = await db
    .select({ id: resourceVersions.id })
    .from(resourceVersions)
    .where(and(eq(resourceVersions.id, versionId), eq(resourceVersions.resourceId, resourceId)))
    .limit(1)
  if (!verRow) throw createError({ statusCode: 404, statusMessage: 'Version not found' })

  const rows = await db
    .select({
      id: resourceVersionFiles.id,
      fileName: resourceVersionFiles.fileName,
      displayName: resourceVersionFiles.displayName,
      mimeType: resourceVersionFiles.mimeType,
      sizeBytes: resourceVersionFiles.sizeBytes,
      sortOrder: resourceVersionFiles.sortOrder,
      isPrimary: resourceVersionFiles.isPrimary,
      publicUrl: resourceVersionFiles.publicUrl,
      createdAt: resourceVersionFiles.createdAt
    })
    .from(resourceVersionFiles)
    .where(and(eq(resourceVersionFiles.resourceId, resourceId), eq(resourceVersionFiles.versionId, versionId)))
    .orderBy(desc(resourceVersionFiles.isPrimary), resourceVersionFiles.sortOrder, desc(resourceVersionFiles.id))

  return { items: rows }
})
