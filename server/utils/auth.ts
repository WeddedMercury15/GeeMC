import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { getCookie } from 'h3'
import { sessions, users } from '../database/schema'
import { useDb } from './db'

export const SESSION_COOKIE = 'geemc_session'

export function hashPassword(password: string) {
  return createHash('sha256').update(password).digest('hex')
}

export async function getCurrentUser(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) {
    return null
  }
  const db = await useDb()
  const tokenHash = hashPassword(token)
  const sessionRows = await db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)).limit(1)
  const session = sessionRows[0]
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    return null
  }

  const userRows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
  const user = userRows[0]
  if (!user) {
    return null
  }

  return user
}
