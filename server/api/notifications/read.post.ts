import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { userNotifications } from '../../database/schema'
import { getCurrentUser } from '../../utils/auth'
import { useDb } from '../../utils/db'
import { markNotificationRead } from '../../utils/resourceFollowNotifications'

const payloadSchema = z.object({
  id: z.number().int().positive().optional(),
  ids: z.array(z.number().int().positive()).optional(),
  all: z.boolean().optional(),
  action: z.enum(['read', 'unread', 'delete']).optional()
})

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const parsed = payloadSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  const action = parsed.data.action ?? 'read'

  const db = await useDb()
  if (parsed.data.all) {
    const now = new Date().toISOString()
    if (action === 'delete') {
      await db.delete(userNotifications).where(eq(userNotifications.userId, user.id))
    } else if (action === 'unread') {
      await db
        .update(userNotifications)
        .set({ readAt: '' })
        .where(eq(userNotifications.userId, user.id))
    } else {
      await db
        .update(userNotifications)
        .set({ readAt: now })
        .where(and(eq(userNotifications.userId, user.id), eq(userNotifications.readAt, '')))
    }
    return { success: true, changed: -1 }
  }

  if (parsed.data.ids && parsed.data.ids.length > 0) {
    const ids = Array.from(new Set(parsed.data.ids))
    const now = new Date().toISOString()
    if (action === 'delete') {
      await db
        .delete(userNotifications)
        .where(and(eq(userNotifications.userId, user.id), inArray(userNotifications.id, ids)))
      return { success: true, changed: ids.length }
    }
    await db
      .update(userNotifications)
      .set({ readAt: action === 'unread' ? '' : now })
      .where(and(eq(userNotifications.userId, user.id), inArray(userNotifications.id, ids)))
    return { success: true, changed: ids.length }
  }

  if (!parsed.data.id) throw createError({ statusCode: 400, statusMessage: 'Missing notification id' })
  if (action === 'delete') {
    await db
      .delete(userNotifications)
      .where(and(eq(userNotifications.userId, user.id), eq(userNotifications.id, parsed.data.id)))
    return { success: true, changed: 1 }
  }
  if (action === 'unread') {
    await db
      .update(userNotifications)
      .set({ readAt: '' })
      .where(and(eq(userNotifications.userId, user.id), eq(userNotifications.id, parsed.data.id)))
    return { success: true, changed: 1 }
  }
  const ok = await markNotificationRead({ db, userId: user.id, id: parsed.data.id })
  if (!ok) throw createError({ statusCode: 404, statusMessage: 'Notification not found' })
  return { success: true, changed: 1 }
})

