import { and, eq } from 'drizzle-orm'
import { resourceReviews, resources } from '../../../../../database/schema'
import { getCurrentUser } from '../../../../../utils/auth'
import { useDb } from '../../../../../utils/db'
import { recalcAndUpdateResourceReviewStats } from '../../../../../utils/resourceReviewStats'
import { resolveUserGroupClaims } from '../../../../../utils/userGroupClaims'

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
      reviewId: resourceReviews.id,
      reviewUserId: resourceReviews.userId,
      reviewState: resourceReviews.reviewState,
      resourceAuthorUserId: resources.authorUserId
    })
    .from(resourceReviews)
    .innerJoin(resources, eq(resourceReviews.resourceId, resources.id))
    .where(and(eq(resourceReviews.id, reviewId), eq(resourceReviews.resourceId, resourceId)))
    .limit(1)

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Review not found' })
  }

  const claims = await resolveUserGroupClaims(db, user.id)
  const isAdmin = claims.permissions.includes('geemc.admin')
  const isReviewOwner = Number(row.reviewUserId) === Number(user.id)
  const isResourceOwner = Number(row.resourceAuthorUserId) === Number(user.id)
  if (!isAdmin && !isReviewOwner && !isResourceOwner) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  if (row.reviewState === 'deleted') {
    return { success: true }
  }

  await db
    .update(resourceReviews)
    .set({ reviewState: 'deleted' })
    .where(eq(resourceReviews.id, reviewId))
  await recalcAndUpdateResourceReviewStats(db, resourceId)
  return { success: true }
})
