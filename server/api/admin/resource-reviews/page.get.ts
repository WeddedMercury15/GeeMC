import { and, count, desc, eq, gte, like, lte, or } from 'drizzle-orm'
import { resourceReviews, resources, users } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { requireGeemcAdmin } from '../../../utils/requireGeemcAdmin'

export default defineEventHandler(async (event) => {
  await requireGeemcAdmin(event)
  const db = await useDb()
  const q = getQuery(event)
  const keyword = typeof q.keyword === 'string' ? q.keyword.trim() : ''
  const ratingMin = Math.max(1, Math.min(5, Number(q.ratingMin) || 1))
  const ratingMax = Math.max(1, Math.min(5, Number(q.ratingMax) || 5))
  const from = typeof q.from === 'string' && q.from ? q.from : ''
  const to = typeof q.to === 'string' && q.to ? q.to : ''
  const state = typeof q.state === 'string' && q.state ? q.state : 'all'
  const page = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(100, Math.max(10, Number(q.pageSize) || 20))
  const offset = (page - 1) * pageSize

  const conds = []
  if (keyword) {
    const keywordCond = or(
      like(resources.title, `%${keyword}%`),
      like(users.username, `%${keyword}%`),
      like(resourceReviews.content, `%${keyword}%`)
    )
    if (keywordCond) conds.push(keywordCond)
  }
  conds.push(gte(resourceReviews.rating, ratingMin))
  conds.push(lte(resourceReviews.rating, ratingMax))
  if (from) conds.push(gte(resourceReviews.time, from))
  if (to) conds.push(lte(resourceReviews.time, to))
  if (state === 'visible' || state === 'deleted') conds.push(eq(resourceReviews.reviewState, state))

  const query = db
    .select({
      id: resourceReviews.id,
      resourceId: resourceReviews.resourceId,
      resourceTitle: resources.title,
      categoryKey: resources.categoryKey,
      userId: resourceReviews.userId,
      userName: users.username,
      rating: resourceReviews.rating,
      content: resourceReviews.content,
      likes: resourceReviews.likes,
      reviewState: resourceReviews.reviewState,
      time: resourceReviews.time
    })
    .from(resourceReviews)
    .innerJoin(resources, eq(resourceReviews.resourceId, resources.id))
    .innerJoin(users, eq(resourceReviews.userId, users.id))
    .orderBy(desc(resourceReviews.time), desc(resourceReviews.id))
    .limit(pageSize)
    .offset(offset)

  const items = conds.length > 0 ? await query.where(and(...conds)) : await query

  const countQuery = db
    .select({ value: count(resourceReviews.id) })
    .from(resourceReviews)
    .innerJoin(resources, eq(resourceReviews.resourceId, resources.id))
    .innerJoin(users, eq(resourceReviews.userId, users.id))
  const [totalRow] = conds.length > 0 ? await countQuery.where(and(...conds)) : await countQuery

  return {
    items,
    total: Number(totalRow?.value ?? 0),
    page,
    pageSize
  }
})
