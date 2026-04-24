import { and, count, eq } from 'drizzle-orm'
import { userNotifications } from '../../database/schema'
import { getCurrentUser } from '../../utils/auth'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) return { unreadTotal: 0 }
  const db = await useDb()
  const [row] = await db
    .select({ value: count(userNotifications.id) })
    .from(userNotifications)
    .where(and(eq(userNotifications.userId, user.id), eq(userNotifications.readAt, '')))
  return { unreadTotal: Number(row?.value ?? 0) }
})

