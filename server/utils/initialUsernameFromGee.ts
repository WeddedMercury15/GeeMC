import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { users } from '../database/schema'
import type { Db } from './db'

const MAX_USERNAME_LEN = 255

export function normalizeGeeUsernameForGeeMc(raw: string, geeExternalId: string): string {
  let s = raw.trim().replace(/\s+/g, ' ')
  if (!s) s = `gee_${geeExternalId}`
  if (s.length > MAX_USERNAME_LEN) s = s.slice(0, MAX_USERNAME_LEN)
  return s
}

async function usernameTaken(db: Db, name: string): Promise<boolean> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.username, name)).limit(1)
  return rows.length > 0
}

export async function pickUsernameForFirstGeeMcLogin(
  db: Db,
  geeUsername: string,
  geeExternalId: string
): Promise<{ username: string, hadCollision: boolean }> {
  const desired = normalizeGeeUsernameForGeeMc(geeUsername, geeExternalId)
  if (!(await usernameTaken(db, desired))) {
    return { username: desired, hadCollision: false }
  }
  const sep = '_'
  for (let i = 0; i < 64; i++) {
    const suffix = randomBytes(3).toString('hex')
    const maxBase = MAX_USERNAME_LEN - sep.length - suffix.length
    const base = desired.slice(0, Math.max(1, maxBase))
    const candidate = `${base}${sep}${suffix}`
    if (!(await usernameTaken(db, candidate))) {
      return { username: candidate, hadCollision: true }
    }
  }
  throw new Error('Could not allocate a unique username')
}
