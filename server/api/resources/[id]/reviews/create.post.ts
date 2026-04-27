import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { resourceReviews, resources } from '../../../../database/schema'
import { getCurrentUser } from '../../../../utils/auth'
import { useDb } from '../../../../utils/db'
import { recalcAndUpdateResourceReviewStats } from '../../../../utils/resourceReviewStats'
import { canManageResourceByTeam } from '../../../../utils/resourceTeam'

const payloadSchema = z.object({
  rating: z.number().int().min(1).max(5),
  content: z.string().min(1).max(5000)
})
const REVIEW_EDIT_COOLDOWN_MS = 20 * 1000

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const resourceId = getRouterParam(event, 'id')
  if (!resourceId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
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
  const [resourceRow] = await db
    .select({
      id: resources.id,
      authorUserId: resources.authorUserId,
      teamMemberUserIds: resources.teamMemberUserIds,
      resourceState: resources.resourceState
    })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)

  if (!resourceRow) {
    throw createError({ statusCode: 404, statusMessage: 'Resource not found' })
  }
  if (resourceRow.resourceState !== 'visible') {
    throw createError({ statusCode: 403, statusMessage: 'Resource is not reviewable' })
  }
  if (canManageResourceByTeam({
    authorUserId: resourceRow.authorUserId,
    teamMemberUserIds: resourceRow.teamMemberUserIds,
    userId: user.id
  })) {
    throw createError({ statusCode: 403, statusMessage: 'Managers cannot review this resource' })
  }

  const [existing] = await db
    .select({ id: resourceReviews.id })
    .from(resourceReviews)
    .where(and(eq(resourceReviews.resourceId, resourceId), eq(resourceReviews.userId, user.id)))
    .limit(1)

  const [latestByUser] = await db
    .select({
      time: resourceReviews.time
    })
    .from(resourceReviews)
    .where(and(eq(resourceReviews.resourceId, resourceId), eq(resourceReviews.userId, user.id)))
    .orderBy(desc(resourceReviews.time), desc(resourceReviews.id))
    .limit(1)
  if (latestByUser?.time) {
    const lastMs = new Date(latestByUser.time).getTime()
    if (Number.isFinite(lastMs) && Date.now() - lastMs < REVIEW_EDIT_COOLDOWN_MS) {
      throw createError({ statusCode: 429, statusMessage: 'Review action is rate-limited, try again later' })
    }
  }

  const now = new Date().toISOString()
  if (existing) {
    await db
      .update(resourceReviews)
      .set({
        rating: parsed.data.rating,
        content: parsed.data.content,
        time: now
      })
      .where(eq(resourceReviews.id, existing.id))
  } else {
    await db.insert(resourceReviews).values({
      resourceId,
      userId: user.id,
      rating: parsed.data.rating,
      content: parsed.data.content,
      likes: 0,
      reviewState: 'visible',
      time: now
    })
  }

  await recalcAndUpdateResourceReviewStats(db, resourceId)
  return { success: true }
})
