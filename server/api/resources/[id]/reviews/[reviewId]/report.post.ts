import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { groupMembers, resourceReviews, resources, userGroups, userNotifications, users } from '../../../../../database/schema'
import { getCurrentUser } from '../../../../../utils/auth'
import { useDb } from '../../../../../utils/db'

const payloadSchema = z.object({
  reason: z.string().trim().min(1).max(500)
})

export default defineEventHandler(async (event) => {
  const reporter = await getCurrentUser(event)
  if (!reporter) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const resourceId = getRouterParam(event, 'id')
  const reviewId = Number(getRouterParam(event, 'reviewId'))
  if (!resourceId || !Number.isFinite(reviewId) || reviewId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid params' })
  }

  const parsed = payloadSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid input',
      data: {
        code: 'VALIDATION_ERROR',
        details: parsed.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      }
    })
  }

  const db = await useDb()
  const [reviewRow] = await db
    .select({
      reviewId: resourceReviews.id,
      reviewUserId: resourceReviews.userId,
      resourceId: resourceReviews.resourceId,
      resourceTitle: resources.title,
      resourceCategoryKey: resources.categoryKey,
      reviewContent: resourceReviews.content,
      reviewUserName: users.username,
      reviewState: resourceReviews.reviewState
    })
    .from(resourceReviews)
    .innerJoin(resources, eq(resourceReviews.resourceId, resources.id))
    .innerJoin(users, eq(resourceReviews.userId, users.id))
    .where(and(eq(resourceReviews.id, reviewId), eq(resourceReviews.resourceId, resourceId)))
    .limit(1)

  if (!reviewRow) {
    throw createError({ statusCode: 404, statusMessage: 'Review not found' })
  }
  if (reviewRow.reviewState !== 'visible') {
    throw createError({ statusCode: 404, statusMessage: 'Review not found' })
  }
  if (Number(reviewRow.reviewUserId) === Number(reporter.id)) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot report your own review' })
  }

  const adminGroups = await db
    .select({ id: userGroups.id })
    .from(userGroups)
    .where(inArray(userGroups.slug as never, ['super_admin', 'administrator']))
  const adminGroupIds = adminGroups.map(g => Number(g.id)).filter(v => Number.isFinite(v) && v > 0)
  if (adminGroupIds.length === 0) {
    return { success: true }
  }

  const members = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(inArray(groupMembers.groupId as never, adminGroupIds))
  const adminUserIds = Array.from(new Set(members.map(m => Number(m.userId)).filter(v => Number.isFinite(v) && v > 0)))
  if (adminUserIds.length === 0) {
    return { success: true }
  }

  const now = new Date().toISOString()
  const reason = parsed.data.reason
  const message = JSON.stringify({
    text: `${reporter.username} reported a review by ${reviewRow.reviewUserName}: ${reason}`,
    target: { tab: 'reviews', anchor: `review-${reviewRow.reviewId}` }
  })

  await db.insert(userNotifications).values(
    adminUserIds.map(adminUserId => ({
      userId: adminUserId,
      type: 'resource_review_report',
      title: `Review report · ${reviewRow.resourceTitle}`,
      message,
      resourceId: reviewRow.resourceId,
      readAt: '',
      createdAt: now
    }))
  )

  return { success: true }
})
