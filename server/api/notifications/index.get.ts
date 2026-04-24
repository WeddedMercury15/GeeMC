import { and, count, desc, eq } from 'drizzle-orm'
import { resources, userNotifications } from '../../database/schema'
import { getCurrentUser } from '../../utils/auth'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const q = getQuery(event)
  const unreadOnly = q.unread === '1'
  const type = typeof q.type === 'string' && q.type ? q.type : ''
  const page = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(100, Math.max(10, Number(q.pageSize) || 20))
  const offset = (page - 1) * pageSize

  const conds = [eq(userNotifications.userId, user.id)]
  if (unreadOnly) conds.push(eq(userNotifications.readAt, ''))
  if (type) conds.push(eq(userNotifications.type, type))

  const db = await useDb()
  const rows = await db
    .select({
      id: userNotifications.id,
      type: userNotifications.type,
      title: userNotifications.title,
      message: userNotifications.message,
      resourceId: userNotifications.resourceId,
      resourceCategoryKey: resources.categoryKey,
      readAt: userNotifications.readAt,
      createdAt: userNotifications.createdAt
    })
    .from(userNotifications)
    .leftJoin(resources, eq(userNotifications.resourceId, resources.id))
    .where(and(...conds))
    .orderBy(desc(userNotifications.createdAt), desc(userNotifications.id))
    .limit(pageSize)
    .offset(offset)

  const items = rows.map((r) => {
    let messageText = r.message
    let target: any = null
    if (typeof r.message === 'string' && r.message.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(r.message)
        if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string') {
          messageText = parsed.text
          target = parsed.target ?? null
        }
      } catch {
        // ignore
      }
    }

    let targetUrl: string | null = null
    if (r.resourceId && r.resourceCategoryKey) {
      const base = `/${r.resourceCategoryKey}/${r.resourceId}`
      if (target && typeof target === 'object' && typeof target.tab === 'string') {
        const tab = String(target.tab)
        const anchor = typeof target.anchor === 'string' && target.anchor ? `#${target.anchor}` : ''
        targetUrl = `${base}?tab=${encodeURIComponent(tab)}${anchor}`
      } else {
        targetUrl = base
      }
    }

    return {
      ...r,
      messageText,
      target,
      targetUrl
    }
  })

  const [totalRow] = await db
    .select({ value: count(userNotifications.id) })
    .from(userNotifications)
    .where(and(...conds))

  const [unreadRow] = await db
    .select({ value: count(userNotifications.id) })
    .from(userNotifications)
    .where(and(eq(userNotifications.userId, user.id), eq(userNotifications.readAt, '')))

  return {
    items,
    total: Number(totalRow?.value ?? 0),
    unreadTotal: Number(unreadRow?.value ?? 0),
    page,
    pageSize
  }
})

