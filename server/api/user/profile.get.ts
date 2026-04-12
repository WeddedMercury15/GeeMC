import { getCurrentUser } from '../../utils/auth'
import { useDb } from '../../utils/db'
import { formatAuthUserForClient } from '../../utils/userGroupClaims'

export default defineEventHandler(async (event) => {
  const row = await getCurrentUser(event)
  if (!row) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const u = row as {
    id: number
    username: string
    createdAt: string
    geeIdUserId?: string | null
  }

  const db = await useDb()
  const claims = await formatAuthUserForClient(
    db,
    {
      id: u.id,
      username: u.username,
      geeIdUserId: u.geeIdUserId ?? null
    },
    event
  )

  const displayName = String(claims.username)
  const created = new Date(u.createdAt)
  const seniorityDays = Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)))

  return {
    user: {
      id: u.id,
      username: displayName,
      email: claims.email ?? undefined,
      groups: claims.groups,
      permissions: claims.permissions,
      createdAt: u.createdAt,
      seniorityDays,
      avatar: claims.avatar
    }
  }
})
