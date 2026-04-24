import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { resourceModerationLogs, users } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { requireGeemcAdmin } from '../../../utils/requireGeemcAdmin'

function csvEscape(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

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

  const header = ['id', 'action', 'source', 'fromState', 'toState', 'actorName', 'createdAt', 'reason']
  const lines = [header.join(',')]
  for (const row of rows) {
    const values = [
      String(row.id),
      row.action,
      row.source,
      row.fromState,
      row.toState,
      row.actorName,
      row.createdAt,
      row.reason ?? ''
    ]
    lines.push(values.map(v => csvEscape(String(v ?? ''))).join(','))
  }

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="resource-${resourceId}-state-logs.csv"`)
  return lines.join('\n')
})

