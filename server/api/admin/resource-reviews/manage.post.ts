import { inArray } from 'drizzle-orm'
import { z } from 'zod'
import { resourceModerationLogs, resourceReviews } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { requireGeemcAdmin } from '../../../utils/requireGeemcAdmin'
import { recalcAndUpdateResourceReviewStats } from '../../../utils/resourceReviewStats'

const payloadSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  intent: z.enum(['delete', 'restore'])
})

export default defineEventHandler(async (event) => {
  const adminUser = await requireGeemcAdmin(event)
  const parsed = payloadSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  }
  const { ids, intent } = parsed.data
  const db = await useDb()
  const rows = await db
    .select({
      id: resourceReviews.id,
      resourceId: resourceReviews.resourceId,
      reviewState: resourceReviews.reviewState
    })
    .from(resourceReviews)
    .where(inArray(resourceReviews.id, ids))
  if (rows.length === 0) return { success: true, changed: 0 }

  if (intent === 'delete') {
    await db
      .update(resourceReviews)
      .set({ reviewState: 'deleted' })
      .where(inArray(resourceReviews.id, rows.map(r => r.id)))
  } else {
    await db
      .update(resourceReviews)
      .set({ reviewState: 'visible' })
      .where(inArray(resourceReviews.id, rows.map(r => r.id)))
  }

  const now = new Date().toISOString()
  for (const row of rows) {
    await db.insert(resourceModerationLogs).values({
      resourceId: row.resourceId,
      actorUserId: Number(adminUser.id),
      action: 'review_delete',
      source: 'admin_review',
      fromState: row.reviewState === 'deleted' ? 'review_deleted' : 'review_visible',
      toState: intent === 'delete' ? 'review_deleted' : 'review_visible',
      reason: `${intent === 'delete' ? 'Deleted' : 'Restored'} review #${row.id}`,
      createdAt: now
    })
  }

  const touchedResourceIds = Array.from(new Set(rows.map(r => r.resourceId)))
  for (const resourceId of touchedResourceIds) {
    await recalcAndUpdateResourceReviewStats(db, resourceId)
  }

  return { success: true, changed: rows.length }
})
