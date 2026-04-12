import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'
import { getCurrentUser } from '../../utils/auth'
import { useDb } from '../../utils/db'

const MAX_USERNAME_LEN = 255

function normalizeUsername(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody<{
    action?: 'change_username'
    username?: string
  }>(event)

  if (body.action !== 'change_username') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid action' })
  }

  const username = normalizeUsername(body.username ?? '')
  if (!username) {
    throw createError({ statusCode: 400, statusMessage: 'Username is required' })
  }
  if (username.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Username is too short' })
  }
  if (username.length > MAX_USERNAME_LEN) {
    throw createError({ statusCode: 400, statusMessage: 'Username is too long' })
  }

  const db = await useDb()
  const existed = await db.select().from(users).where(eq(users.username, username)).limit(1)
  if (existed[0] && Number(existed[0].id) !== Number(user.id)) {
    throw createError({ statusCode: 400, statusMessage: 'Username already taken' })
  }

  await db.update(users).set({ username }).where(eq(users.id, user.id))
  return { success: true }
})
