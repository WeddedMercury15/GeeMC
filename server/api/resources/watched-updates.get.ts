import { and, count, desc, eq, gt, gte, or } from 'drizzle-orm'
import { resourceFollows, resourceUpdates, resources } from '../../database/schema'
import { getCurrentUser } from '../../utils/auth'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = await useDb()
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(100, Math.max(10, Number(q.pageSize) || 20))
  const timeWindow = String(q.window || 'all')
  const unreadOnly = String(q.unread || '') === '1'
  const nowMs = Date.now()
  const timeWindowMsMap: Record<string, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  }
  const cutoffMs = timeWindowMsMap[timeWindow]
  const cutoffIso = cutoffMs ? new Date(nowMs - cutoffMs).toISOString() : ''

  const whereConds = [
    eq(resourceFollows.userId, user.id),
    eq(resources.resourceState, 'visible'),
    eq(resourceUpdates.messageState, 'visible'),
    eq(resourceUpdates.isDescription, false)
  ]
  if (cutoffIso) {
    whereConds.push(gte(resourceUpdates.postDate, cutoffIso))
  }
  if (unreadOnly) {
    whereConds.push(
      or(
        eq(resourceFollows.lastReadAt, ''),
        gt(resourceUpdates.postDate, resourceFollows.lastReadAt)
      ) as never
    )
  }
  const whereVisible = and(...whereConds)

  const totalRows = await db
    .select({ count: count() })
    .from(resourceFollows)
    .innerJoin(resources, eq(resourceFollows.resourceId, resources.id))
    .innerJoin(resourceUpdates, eq(resourceUpdates.resourceId, resources.id))
    .where(whereVisible)
  const total = Number(totalRows[0]?.count ?? 0)
  const unreadTotalRows = await db
    .select({ count: count() })
    .from(resourceFollows)
    .innerJoin(resources, eq(resourceFollows.resourceId, resources.id))
    .innerJoin(resourceUpdates, eq(resourceUpdates.resourceId, resources.id))
    .where(and(
      eq(resourceFollows.userId, user.id),
      eq(resources.resourceState, 'visible'),
      eq(resourceUpdates.messageState, 'visible'),
      eq(resourceUpdates.isDescription, false),
      or(
        eq(resourceFollows.lastReadAt, ''),
        gt(resourceUpdates.postDate, resourceFollows.lastReadAt)
      ) as never
    ))
  const unreadTotal = Number(unreadTotalRows[0]?.count ?? 0)

  const rows = await db
    .select({
      updateId: resourceUpdates.id,
      resourceId: resourceUpdates.resourceId,
      resourceTitle: resources.title,
      resourceCategoryKey: resources.categoryKey,
      followLastReadAt: resourceFollows.lastReadAt,
      title: resourceUpdates.title,
      versionString: resourceUpdates.versionString,
      message: resourceUpdates.message,
      postDate: resourceUpdates.postDate,
      updateType: resourceUpdates.updateType
    })
    .from(resourceFollows)
    .innerJoin(resources, eq(resourceFollows.resourceId, resources.id))
    .innerJoin(resourceUpdates, eq(resourceUpdates.resourceId, resources.id))
    .where(whereVisible)
    .orderBy(desc(resourceUpdates.postDate), desc(resourceUpdates.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    items: rows.map(r => ({
      id: Number(r.updateId),
      resourceId: r.resourceId,
      resourceTitle: r.resourceTitle,
      resourceCategoryKey: r.resourceCategoryKey,
      isNew: !r.followLastReadAt || r.postDate > r.followLastReadAt,
      title: r.title || '',
      version: r.versionString || '',
      message: r.message || '',
      time: r.postDate,
      updateType: r.updateType || 'update'
    })),
    total,
    page,
    pageSize,
    window: timeWindowMsMap[timeWindow] ? timeWindow : 'all',
    unreadOnly,
    unreadTotal
  }
})
