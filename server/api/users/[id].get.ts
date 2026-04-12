import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'
import { resolveUserAvatarUrl } from '../../utils/avatarUrl'
import { useDb } from '../../utils/db'
import { resolveUserGroupClaims } from '../../utils/userGroupClaims'

function parseUserId(raw: string | undefined): number | null {
  if (!raw?.trim()) return null
  const n = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(n) || n < 1) return null
  return n
}

export default defineEventHandler(async (event) => {
  const id = parseUserId(getRouterParam(event, 'id'))
  if (id == null) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user id' })
  }

  let db
  try {
    db = await useDb()
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }

  let rows
  try {
    rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }

  const row = rows[0]
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const displayName = String(row.username)
  const avatar = resolveUserAvatarUrl(null, row.geeIdUserId ?? null)
  const claims = await resolveUserGroupClaims(db, row.id)

  return {
    user: {
      id: row.id,
      username: displayName,
      groups: claims.groupNames,
      createdAt: String(row.createdAt),
      avatar
    }
  }
})
