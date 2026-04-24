import { eq } from 'drizzle-orm'
import { resourceUpdates, resources } from '../../../../../database/schema'
import { getCurrentUser } from '../../../../../utils/auth'
import { useDb } from '../../../../../utils/db'
import { canManageResourceByTeam } from '../../../../../utils/resourceTeam'
import { resolveUserGroupClaims } from '../../../../../utils/userGroupClaims'

export default defineEventHandler(async (event) => {
  const updateId = Number(getRouterParam(event, 'updateId'))
  if (!Number.isFinite(updateId) || updateId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid updateId' })
  }

  const db = await useDb()
  const currentUser = await getCurrentUser(event)
  const currentUserPerms = currentUser
    ? (await resolveUserGroupClaims(db, currentUser.id)).permissions
    : []

  const [row] = await db
    .select({
      updateId: resourceUpdates.id,
      isDescription: resourceUpdates.isDescription,
      messageState: resourceUpdates.messageState,
      resourceId: resources.id,
      resourceCategoryKey: resources.categoryKey,
      resourceState: resources.resourceState,
      authorUserId: resources.authorUserId,
      teamMemberUserIds: resources.teamMemberUserIds
    })
    .from(resourceUpdates)
    .innerJoin(resources, eq(resourceUpdates.resourceId, resources.id))
    .where(eq(resourceUpdates.id, updateId))
    .limit(1)
  if (!row || row.isDescription) {
    throw createError({ statusCode: 404, statusMessage: 'Update not found' })
  }

  const canManage = !!currentUser
    && currentUserPerms.includes('geemc.publish')
    && canManageResourceByTeam({
      authorUserId: row.authorUserId,
      teamMemberUserIds: row.teamMemberUserIds,
      userId: currentUser.id
    })
  const canSee = row.resourceState === 'visible' && row.messageState === 'visible'
  if (!canSee && !canManage) {
    throw createError({ statusCode: 404, statusMessage: 'Update not found' })
  }

  return {
    resourceId: row.resourceId,
    resourceCategoryKey: row.resourceCategoryKey,
    tab: 'changelog',
    anchor: `update-${row.updateId}`
  }
})
