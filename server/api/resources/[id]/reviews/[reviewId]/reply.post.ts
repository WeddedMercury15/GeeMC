import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { resourceReviewReplies, resourceReviews, resources } from '../../../../../database/schema'
import { getCurrentUser } from '../../../../../utils/auth'
import { useDb } from '../../../../../utils/db'
import { canManageResourceByTeam } from '../../../../../utils/resourceTeam'
import { resolveUserGroupClaims } from '../../../../../utils/userGroupClaims'

const payloadSchema = z.object({
  message: z.string().trim().min(1).max(5000)
})

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
  const [row] = await db
    .select({
      resourceId: resources.id,
      authorUserId: resources.authorUserId,
      teamMemberUserIds: resources.teamMemberUserIds,
      reviewId: resourceReviews.id
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

  const now = new Date().toISOString()
  const [existing] = await db
    .select({ reviewId: resourceReviewReplies.reviewId })
    .from(resourceReviewReplies)
    .where(eq(resourceReviewReplies.reviewId, reviewId))
    .limit(1)

  if (existing) {
    await db
      .update(resourceReviewReplies)
      .set({
        replierUserId: user.id,
        message: parsed.data.message,
        updatedAt: now
      })
      .where(eq(resourceReviewReplies.reviewId, reviewId))
  } else {
    await db.insert(resourceReviewReplies).values({
      reviewId,
      replierUserId: user.id,
      message: parsed.data.message,
      createdAt: now,
      updatedAt: now
    })
  }

  return { success: true }
})
