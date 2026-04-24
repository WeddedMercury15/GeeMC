import { eq } from 'drizzle-orm'
import { resourceFollows } from '../../../database/schema'
import { getCurrentUser } from '../../../utils/auth'
import { useDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = await useDb()
  const now = new Date().toISOString()
  await db
    .update(resourceFollows)
    .set({ lastReadAt: now })
    .where(eq(resourceFollows.userId, user.id))

  return { success: true, readAt: now }
})
