import { and, count, desc, eq, inArray, like, or } from 'drizzle-orm'
import { resourceCategories, resources, users } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { requireGeemcAdmin } from '../../../utils/requireGeemcAdmin'

export default defineEventHandler(async (event) => {
  await requireGeemcAdmin(event)
  const db = await useDb()
  const q = getQuery(event)

  const state = typeof q.state === 'string' && q.state ? q.state : 'all'
  const category = typeof q.category === 'string' && q.category ? q.category : ''
  const keyword = typeof q.keyword === 'string' && q.keyword.trim() ? q.keyword.trim() : ''
  const page = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(100, Math.max(10, Number(q.pageSize) || 20))
  const offset = (page - 1) * pageSize

  const conds = []
  if (state !== 'all') conds.push(eq(resources.resourceState, state))
  if (category) conds.push(eq(resources.categoryKey, category))
  if (keyword) {
    conds.push(or(like(resources.title, `%${keyword}%`), like(users.username, `%${keyword}%`)))
  }

  const query = db
    .select({
      id: resources.id,
      title: resources.title,
      categoryKey: resources.categoryKey,
      categoryName: resourceCategories.name,
      authorUserId: resources.authorUserId,
      authorName: users.username,
      teamMemberUserIds: resources.teamMemberUserIds,
      viewCount: resources.viewCount,
      resourceState: resources.resourceState,
      updateDate: resources.updateDate,
      publishedAt: resources.publishedAt,
      updateCount: resources.updateCount
    })
    .from(resources)
    .innerJoin(users, eq(resources.authorUserId, users.id))
    .leftJoin(resourceCategories, eq(resources.categoryKey, resourceCategories.slug))
    .orderBy(desc(resources.updateDate), desc(resources.publishedAt))
    .limit(pageSize)
    .offset(offset)

  const itemsRaw = conds.length > 0 ? await query.where(and(...conds)) : await query
  const allTeamIds = Array.from(
    new Set(
      itemsRaw
        .flatMap(r => Array.isArray(r.teamMemberUserIds) ? r.teamMemberUserIds : [])
        .map(v => Number(v))
        .filter(v => Number.isFinite(v) && v > 0)
    )
  )
  const teamUserMap = new Map<number, string>()
  if (allTeamIds.length > 0) {
    const teamUsers = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.id, allTeamIds))
    for (const u of teamUsers) {
      teamUserMap.set(Number(u.id), u.username)
    }
  }
  const items = itemsRaw.map((r) => {
    const teamIds = Array.isArray(r.teamMemberUserIds) ? r.teamMemberUserIds.map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0) : []
    const teamMemberNames = teamIds.map(id => teamUserMap.get(id)).filter(Boolean) as string[]
    return {
      ...r,
      teamMemberUserIds: teamIds,
      teamMemberNames
    }
  })

  const countQuery = db
    .select({ value: count(resources.id) })
    .from(resources)
    .innerJoin(users, eq(resources.authorUserId, users.id))
  const [totalRow] = conds.length > 0 ? await countQuery.where(and(...conds)) : await countQuery
  const total = Number(totalRow?.value ?? 0)

  const categories = await db
    .select({
      slug: resourceCategories.slug,
      name: resourceCategories.name
    })
    .from(resourceCategories)
    .orderBy(resourceCategories.id)

  return { items, categories, total, page, pageSize }
})

