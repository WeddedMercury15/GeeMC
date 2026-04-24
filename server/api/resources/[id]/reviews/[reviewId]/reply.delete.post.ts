import { and, eq } from 'drizzle-orm'
import { resourceReviewReplies, resourceReviews, resources } from '../../../../../../database/schema'
import { getCurrentUser } from '../../../../../../utils/auth'
import { useDb } from '../../../../../../utils/db'
import { canManageResourceByTeam } from '../../../../../../utils/resourceTeam'
import { resolveUserGroupClaims } from '../../../../../../utils/userGroupClaims'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const resourceId = getRouterParam(event, 'id')
  const reviewId = Number(getRouterParam(event, 'reviewId'))
  if (!resourceId || !Number.isFinite(reviewId) || reviewId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid params' })
  }

  const db = await useDb()
  const [row] = await db
    .select({
      resourceId: resources.id,
      authorUserId: resources.authorUserId,
      teamMemberUserIds: resources.teamMemberUserIds
    })
    .from(resources)
    .innerJoin(resourceReviews, and(eq(resourceReviews.resourceId, resources.id), eq(resourceReviews.id, reviewId)))
    .where(eq(resources.id, resourceId))
    .limit(1)
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Review not found' })
  }

  const claims = await resolveUserGroupClaims(db, user.id)
  const canManage = canManageResourceByTeam({
    authorUserId: row.authorUserId,
    teamMemberUserIds: row.teamMemberUserIds,
    userId: user.id
  })
  if (!canManage && !claims.permissions.includes('geemc.admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  await db.delete(resourceReviewReplies).where(eq(resourceReviewReplies.reviewId, reviewId))
  return { success: true }
})
