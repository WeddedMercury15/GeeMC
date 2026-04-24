import { and, desc, eq, sql } from 'drizzle-orm'
import { resourceVersionFiles, resourceVersions, resources } from '../../../../../../../database/schema'
import { getCurrentUser } from '../../../../../../../utils/auth'
import { useDb } from '../../../../../../../utils/db'
import { canManageResourceByTeam } from '../../../../../../../utils/resourceTeam'
import { resolveUserGroupClaims } from '../../../../../../../utils/userGroupClaims'

export default defineEventHandler(async (event) => {
  const resourceId = getRouterParam(event, 'id')
  const versionIdRaw = getRouterParam(event, 'versionId')
  const fileIdRaw = getRouterParam(event, 'fileId')
  const versionId = Number(versionIdRaw)
  const fileId = Number(fileIdRaw)
  if (!resourceId || !Number.isFinite(versionId) || versionId <= 0 || !Number.isFinite(fileId) || fileId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  }

  const db = await useDb()
  const currentUser = await getCurrentUser(event)
  const currentUserPerms = currentUser
    ? (await resolveUserGroupClaims(db, currentUser.id)).permissions
    : []

  const [resRow] = await db
    .select({
      resourceState: resources.resourceState,
      authorUserId: resources.authorUserId,
      teamMemberUserIds: resources.teamMemberUserIds
    })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)
  if (!resRow) {
    throw createError({ statusCode: 404, statusMessage: 'Resource not found' })
  }

  const canViewNonVisible =
    !!currentUser &&
    currentUserPerms.includes('geemc.publish') &&
    canManageResourceByTeam({
      authorUserId: resRow.authorUserId,
      teamMemberUserIds: resRow.teamMemberUserIds,
      userId: currentUser.id
    })

  if (resRow.resourceState !== 'visible' && !canViewNonVisible) {
    throw createError({ statusCode: 404, statusMessage: 'Resource not found' })
  }

  const [verRow] = await db
    .select({ id: resourceVersions.id })
    .from(resourceVersions)
    .where(and(eq(resourceVersions.id, versionId), eq(resourceVersions.resourceId, resourceId)))
    .limit(1)
  if (!verRow) throw createError({ statusCode: 404, statusMessage: 'Version not found' })

  const [fileRow] = await db
    .select({ publicUrl: resourceVersionFiles.publicUrl })
    .from(resourceVersionFiles)
    .where(and(
      eq(resourceVersionFiles.id, fileId),
      eq(resourceVersionFiles.resourceId, resourceId),
      eq(resourceVersionFiles.versionId, versionId)
    ))
    .orderBy(desc(resourceVersionFiles.id))
    .limit(1)
  if (!fileRow?.publicUrl) throw createError({ statusCode: 404, statusMessage: 'File not found' })

  // Count as a download when fetching file url.
  await db
    .update(resourceVersions)
    .set({ downloadsCount: sql`${resourceVersions.downloadsCount} + 1` })
    .where(eq(resourceVersions.id, versionId))

  await db
    .update(resources)
    .set({ downloadsCount: sql`${resources.downloadsCount} + 1` })
    .where(eq(resources.id, resourceId))

  return { success: true, url: fileRow.publicUrl }
})

