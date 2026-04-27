import { and, count, desc, eq } from 'drizzle-orm'
import { resources, userNotifications, users } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { requireGeemcAdmin } from '../../../utils/requireGeemcAdmin'

export default defineEventHandler(async (event) => {
  await requireGeemcAdmin(event)
  const db = await useDb()
  const q = getQuery(event)
  const type = typeof q.type === 'string' && q.type ? q.type : ''
  const unreadOnly = q.unread === '1'
  const page = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(100, Math.max(10, Number(q.pageSize) || 20))
  const offset = (page - 1) * pageSize

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
      resourceCategoryKey: resources.categoryKey,
      readAt: userNotifications.readAt,
      createdAt: userNotifications.createdAt
    })
    .from(userNotifications)
    .innerJoin(users, eq(userNotifications.userId, users.id))
    .leftJoin(resources, eq(userNotifications.resourceId, resources.id))
    .orderBy(desc(userNotifications.createdAt), desc(userNotifications.id))
    .limit(pageSize)
    .offset(offset)

  const items = conds.length > 0 ? await base.where(and(...conds)) : await base
  const countQuery = db.select({ value: count(userNotifications.id) }).from(userNotifications)
  const [totalRow] = conds.length > 0 ? await countQuery.where(and(...conds)) : await countQuery

  const parsedItems = items.map((r) => {
    let messageText = r.message
    let target: unknown = null
    if (typeof r.message === 'string' && r.message.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(r.message) as { text?: string, target?: unknown }
        if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string') {
          messageText = parsed.text
          target = parsed.target ?? null
        }
      } catch {
        // keep raw message
      }
    }

    let targetUrl: string | null = null
    if (r.resourceId) {
      const base = `/resources/${r.resourceId}`
      if (target && typeof target === 'object' && target !== null && 'tab' in target) {
        const tab = String((target as { tab?: string }).tab ?? '')
        const anchorValue = (target as { anchor?: string }).anchor
        const anchor = typeof anchorValue === 'string' && anchorValue ? `#${anchorValue}` : ''
        targetUrl = tab ? `${base}?tab=${encodeURIComponent(tab)}${anchor}` : `${base}${anchor}`
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

  return {
    items: parsedItems,
    total: Number(totalRow?.value ?? 0),
    page,
    pageSize
  }
})
