import { and, eq } from 'drizzle-orm'
import { resourceReviews, resources } from '../database/schema'
import type { Db } from './db'

export async function recalcAndUpdateResourceReviewStats(db: Db, resourceId: string) {
  const rows = await db
    .select({
      rating: resourceReviews.rating
    })
    .from(resourceReviews)
    .where(and(eq(resourceReviews.resourceId, resourceId), eq(resourceReviews.reviewState, 'visible')))

  const reviewCount = rows.length
  await db
    .update(resources)
    .set({
      reviewCount
    })
    .where(eq(resources.id, resourceId))
}
