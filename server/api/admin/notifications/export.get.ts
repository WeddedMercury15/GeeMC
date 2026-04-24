import { and, desc, eq } from 'drizzle-orm'
import { userNotifications, users } from '../../../database/schema'
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
  const db = await useDb()
  const q = getQuery(event)
  const type = typeof q.type === 'string' && q.type ? q.type : ''
  const unreadOnly = q.unread === '1'

  const conds = []
  if (type) conds.push(eq(userNotifications.type, type))
  if (unreadOnly) conds.push(eq(userNotifications.readAt, ''))

  const base = db
    .select({
      id: userNotifications.id,
      userId: userNotifications.userId,
      userName: users.username,
      type: userNotifications.type,
      title: userNotifications.title,
      message: userNotifications.message,
      resourceId: userNotifications.resourceId,
      readAt: userNotifications.readAt,
      createdAt: userNotifications.createdAt
    })
    .from(userNotifications)
    .innerJoin(users, eq(userNotifications.userId, users.id))
    .orderBy(desc(userNotifications.createdAt), desc(userNotifications.id))

  const rows = conds.length > 0 ? await base.where(and(...conds)) : await base
  const header = ['id', 'userId', 'userName', 'type', 'title', 'message', 'resourceId', 'readAt', 'createdAt']
  const lines = [header.join(',')]
  for (const row of rows) {
    const values = [
      String(row.id),
      String(row.userId),
      row.userName,
      row.type,
      row.title,
      row.message,
      row.resourceId ?? '',
      row.readAt ?? '',
      row.createdAt
    ]
    lines.push(values.map(v => csvEscape(String(v ?? ''))).join(','))
  }

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', 'attachment; filename="notifications-audit.csv"')
  return lines.join('\n')
})

