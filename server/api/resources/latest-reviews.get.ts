import { and, count, desc, eq } from 'drizzle-orm'
import { resourceReviews, resources, users } from '../../database/schema'
import { resolveUserAvatarUrl } from '../../utils/avatarUrl'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = await useDb()
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(100, Math.max(10, Number(q.pageSize) || 20))

  const whereVisible = and(eq(resources.resourceState, 'visible'), eq(resourceReviews.reviewState, 'visible'))
  const totalRows = await db
    .select({ count: count() })
    .from(resourceReviews)
    .innerJoin(resources, eq(resourceReviews.resourceId, resources.id))
    .where(whereVisible)
  const total = Number(totalRows[0]?.count ?? 0)

  const rows = await db
    .select({
      reviewId: resourceReviews.id,
      resourceId: resourceReviews.resourceId,
      resourceTitle: resources.title,
      resourceCategoryKey: resources.categoryKey,
      reviewUserId: resourceReviews.userId,
      reviewUserName: users.username,
      reviewUserGeeId: users.geeIdUserId,
      rating: resourceReviews.rating,
      content: resourceReviews.content,
      likes: resourceReviews.likes,
      time: resourceReviews.time
    })
    .from(resourceReviews)
    .innerJoin(resources, eq(resourceReviews.resourceId, resources.id))
    .innerJoin(users, eq(resourceReviews.userId, users.id))
    .where(whereVisible)
    .orderBy(desc(resourceReviews.time), desc(resourceReviews.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    items: rows.map(r => ({
      id: Number(r.reviewId),
      resourceId: r.resourceId,
      resourceTitle: r.resourceTitle,
      resourceCategoryKey: r.resourceCategoryKey,
      userId: Number(r.reviewUserId),
      userName: r.reviewUserName,
      userAvatar: resolveUserAvatarUrl(null, r.reviewUserGeeId) ?? '',
      rating: Number(r.rating ?? 0),
      content: r.content,
      likes: Number(r.likes ?? 0),
      time: r.time
    })),
    total,
    page,
    pageSize
  }
})
