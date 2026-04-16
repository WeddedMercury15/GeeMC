import { desc } from 'drizzle-orm'
import { users } from '../../database/schema'
import { resolveUserAvatarUrl } from '../../utils/avatarUrl'
import { requireGeemcAdmin } from '../../utils/requireGeemcAdmin'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  await requireGeemcAdmin(event)

  const db = await useDb()

  const latestUsers = await db
    .select({
      id: users.id,
      username: users.username,
      geeIdUserId: users.geeIdUserId,
      createdAt: users.createdAt
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(8)

  const activities = latestUsers.map((u) => ({
    id: u.id,
    username: u.username,
    avatar: resolveUserAvatarUrl(null, u.geeIdUserId ?? null),
    type: 'new_user' as const,
    timestamp: u.createdAt
  }))

  return { activities }
})
