import { and, eq, gt, or } from 'drizzle-orm'
import { resourceReviews } from '../../../../../database/schema'
import { useDb } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const resourceId = getRouterParam(event, 'id')
  const reviewId = Number(getRouterParam(event, 'reviewId'))
  if (!resourceId || !Number.isFinite(reviewId) || reviewId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid params' })
  }

  const q = getQuery(event)
  const pageSize = Math.min(100, Math.max(10, Number(q.pageSize) || 20))
  const db = await useDb()

  const [target] = await db
    .select({
      id: resourceReviews.id,
      time: resourceReviews.time
    })
    .from(resourceReviews)
    .where(and(
      eq(resourceReviews.id, reviewId),
      eq(resourceReviews.resourceId, resourceId),
      eq(resourceReviews.reviewState, 'visible')
    ))
    .limit(1)
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'Review not found' })
  }

  const newerRows = await db
    .select({ id: resourceReviews.id })
    .from(resourceReviews)
    .where(and(
      eq(resourceReviews.resourceId, resourceId),
      eq(resourceReviews.reviewState, 'visible'),
      or(
        gt(resourceReviews.time, target.time),
        and(eq(resourceReviews.time, target.time), gt(resourceReviews.id, target.id))
      )!
    ))

  const page = Math.floor(newerRows.length / pageSize) + 1
  return {
    page,
    pageSize,
    anchor: `review-${reviewId}`
  }
})
