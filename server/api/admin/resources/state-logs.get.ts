import { and, count, desc, eq, gte, lte } from 'drizzle-orm'
import { resourceModerationLogs, users } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { requireGeemcAdmin } from '../../../utils/requireGeemcAdmin'

export default defineEventHandler(async (event) => {
  await requireGeemcAdmin(event)
  const q = getQuery(event)
  const resourceId = q.resourceId
  if (typeof resourceId !== 'string' || !resourceId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing resourceId' })
  }
  const from = typeof q.from === 'string' && q.from ? q.from : ''
  const to = typeof q.to === 'string' && q.to ? q.to : ''
  const action = typeof q.action === 'string' && q.action ? q.action : ''
  const page = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(100, Math.max(10, Number(q.pageSize) || 20))
  const offset = (page - 1) * pageSize

  const db = await useDb()
  const conds = [eq(resourceModerationLogs.resourceId, resourceId)]
  if (action) conds.push(eq(resourceModerationLogs.action, action))
  if (from) conds.push(gte(resourceModerationLogs.createdAt, from))
  if (to) conds.push(lte(resourceModerationLogs.createdAt, to))

  const rows = await db
    .select({
      id: resourceModerationLogs.id,
      action: resourceModerationLogs.action,
      source: resourceModerationLogs.source,
      fromState: resourceModerationLogs.fromState,
      toState: resourceModerationLogs.toState,
      reason: resourceModerationLogs.reason,
      createdAt: resourceModerationLogs.createdAt,
      actorName: users.username
    })
    .from(resourceModerationLogs)
    .innerJoin(users, eq(resourceModerationLogs.actorUserId, users.id))
    .where(and(...conds))
    .orderBy(desc(resourceModerationLogs.createdAt), desc(resourceModerationLogs.id))
    .limit(pageSize)
    .offset(offset)

  const [totalRow] = await db
    .select({ value: count(resourceModerationLogs.id) })
    .from(resourceModerationLogs)
    .where(and(...conds))

  return {
    items: rows,
    total: Number(totalRow?.value ?? 0),
    page,
    pageSize
  }
})

