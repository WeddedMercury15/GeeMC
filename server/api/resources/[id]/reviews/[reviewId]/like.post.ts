import { and, eq } from 'drizzle-orm'
import { resourceReviews, resourceReviewVotes } from '../../../../../database/schema'
import { getCurrentUser } from '../../../../../utils/auth'
import { useDb } from '../../../../../utils/db'

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
      id: resourceReviews.id,
      likes: resourceReviews.likes,
      reviewState: resourceReviews.reviewState
    })
    .from(resourceReviews)
    .where(and(eq(resourceReviews.id, reviewId), eq(resourceReviews.resourceId, resourceId)))
    .limit(1)

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Review not found' })
  }
  if (row.reviewState !== 'visible') {
    throw createError({ statusCode: 404, statusMessage: 'Review not found' })
  }

  const [existingVote] = await db
    .select({ reviewId: resourceReviewVotes.reviewId })
    .from(resourceReviewVotes)
    .where(and(eq(resourceReviewVotes.reviewId, reviewId), eq(resourceReviewVotes.userId, user.id)))
    .limit(1)

  const currentLikes = Math.max(0, Number(row.likes ?? 0))
  if (existingVote) {
    await db
      .delete(resourceReviewVotes)
      .where(and(eq(resourceReviewVotes.reviewId, reviewId), eq(resourceReviewVotes.userId, user.id)))
    await db
      .update(resourceReviews)
      .set({ likes: Math.max(0, currentLikes - 1) })
      .where(eq(resourceReviews.id, reviewId))
    return { success: true, liked: false }
  }

  await db.insert(resourceReviewVotes).values({
    reviewId,
    userId: user.id,
    createdAt: new Date().toISOString()
  })
  await db
    .update(resourceReviews)
    .set({ likes: currentLikes + 1 })
    .where(eq(resourceReviews.id, reviewId))

  return { success: true, liked: true }
})
