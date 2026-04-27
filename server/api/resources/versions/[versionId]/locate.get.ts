import { eq } from 'drizzle-orm'
import { resourceVersions, resources } from '../../../../database/schema'
import { getCurrentUser } from '../../../../utils/auth'
import { useDb } from '../../../../utils/db'
import { canManageResourceByTeam } from '../../../../utils/resourceTeam'
import { resolveUserGroupClaims } from '../../../../utils/userGroupClaims'

export default defineEventHandler(async (event) => {
  const versionId = Number(getRouterParam(event, 'versionId'))
  if (!Number.isFinite(versionId) || versionId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid versionId' })
  }

  const db = await useDb()
  const currentUser = await getCurrentUser(event)
  const currentUserPerms = currentUser
    ? (await resolveUserGroupClaims(db, currentUser.id)).permissions
    : []

  const [row] = await db
    .select({
      versionId: resourceVersions.id,
      resourceId: resources.id,
      resourceCategoryKey: resources.categoryKey,
      resourceState: resources.resourceState,
      authorUserId: resources.authorUserId,
      teamMemberUserIds: resources.teamMemberUserIds
    })
    .from(resourceVersions)
    .innerJoin(resources, eq(resourceVersions.resourceId, resources.id))
    .where(eq(resourceVersions.id, versionId))
    .limit(1)
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Version not found' })
  }

  const canManage = !!currentUser
    && currentUserPerms.includes('geemc.publish')
    && canManageResourceByTeam({
      authorUserId: row.authorUserId,
      teamMemberUserIds: row.teamMemberUserIds,
      userId: currentUser.id
    })
  if (row.resourceState !== 'visible' && !canManage) {
    throw createError({ statusCode: 404, statusMessage: 'Version not found' })
  }

  return {
    resourceId: row.resourceId,
    resourceCategoryKey: row.resourceCategoryKey,
    tab: 'versions',
    anchor: `version-${row.versionId}`
  }
})
