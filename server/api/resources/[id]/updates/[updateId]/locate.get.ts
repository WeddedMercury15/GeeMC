import { and, eq } from 'drizzle-orm'
import { resourceUpdates, resources } from '../../../../../../database/schema'
import { getCurrentUser } from '../../../../../../utils/auth'
import { useDb } from '../../../../../../utils/db'
import { canManageResourceByTeam } from '../../../../../../utils/resourceTeam'
import { resolveUserGroupClaims } from '../../../../../../utils/userGroupClaims'

export default defineEventHandler(async (event) => {
  const resourceId = getRouterParam(event, 'id')
  const updateId = Number(getRouterParam(event, 'updateId'))
  if (!resourceId || !Number.isFinite(updateId) || updateId <= 0) {
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

  const canSeeDeleted = !!currentUser
    && currentUserPerms.includes('geemc.publish')
    && canManageResourceByTeam({
      authorUserId: resourceRow.authorUserId,
      teamMemberUserIds: resourceRow.teamMemberUserIds,
      userId: currentUser.id
    })

  if (resourceRow.resourceState !== 'visible' && !canSeeDeleted) {
    throw createError({ statusCode: 404, statusMessage: 'Resource not found' })
  }

  const [updateRow] = await db
    .select({
      id: resourceUpdates.id,
      isDescription: resourceUpdates.isDescription,
      messageState: resourceUpdates.messageState
    })
    .from(resourceUpdates)
    .where(and(eq(resourceUpdates.id, updateId), eq(resourceUpdates.resourceId, resourceId)))
    .limit(1)
  if (!updateRow || updateRow.isDescription) {
    throw createError({ statusCode: 404, statusMessage: 'Update not found' })
  }
  if (updateRow.messageState !== 'visible' && !canSeeDeleted) {
    throw createError({ statusCode: 404, statusMessage: 'Update not found' })
  }

  return {
    tab: 'changelog',
    anchor: `update-${updateId}`
  }
})
