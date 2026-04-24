import { and, eq } from 'drizzle-orm'
import { resourceVersions, resources } from '../../../../../../database/schema'
import { getCurrentUser } from '../../../../../../utils/auth'
import { useDb } from '../../../../../../utils/db'
import { canManageResourceByTeam } from '../../../../../../utils/resourceTeam'
import { resolveUserGroupClaims } from '../../../../../../utils/userGroupClaims'

export default defineEventHandler(async (event) => {
  const resourceId = getRouterParam(event, 'id')
  const versionId = Number(getRouterParam(event, 'versionId'))
  if (!resourceId || !Number.isFinite(versionId) || versionId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid params' })
  }

  const db = await useDb()
  const currentUser = await getCurrentUser(event)
  const currentUserPerms = currentUser
    ? (await resolveUserGroupClaims(db, currentUser.id)).permissions
    : []

  const [resourceRow] = await db
    .select({
      id: resources.id,
      resourceState: resources.resourceState,
      authorUserId: resources.authorUserId,
      teamMemberUserIds: resources.teamMemberUserIds
    })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)
  if (!resourceRow) {
    throw createError({ statusCode: 404, statusMessage: 'Resource not found' })
  }

  const canSeeHiddenResource = !!currentUser
    && currentUserPerms.includes('geemc.publish')
    && canManageResourceByTeam({
      authorUserId: resourceRow.authorUserId,
      teamMemberUserIds: resourceRow.teamMemberUserIds,
      userId: currentUser.id
    })
  if (resourceRow.resourceState !== 'visible' && !canSeeHiddenResource) {
    throw createError({ statusCode: 404, statusMessage: 'Resource not found' })
  }

  const [versionRow] = await db
    .select({ id: resourceVersions.id })
    .from(resourceVersions)
    .where(and(eq(resourceVersions.id, versionId), eq(resourceVersions.resourceId, resourceId)))
    .limit(1)
  if (!versionRow) {
    throw createError({ statusCode: 404, statusMessage: 'Version not found' })
  }

  return {
    tab: 'versions',
    anchor: `version-${versionId}`
  }
})
