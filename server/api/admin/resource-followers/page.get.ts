import { count, desc, eq } from 'drizzle-orm'
import { resourceFollows, resources, users } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { requireGeemcAdmin } from '../../../utils/requireGeemcAdmin'

export default defineEventHandler(async (event) => {
  await requireGeemcAdmin(event)
  const db = await useDb()

  const topResources = await db
    .select({
      resourceId: resources.id,
      title: resources.title,
      categoryKey: resources.categoryKey,
      followersCount: resources.followersCount
    })
    .from(resources)
    .orderBy(desc(resources.followersCount), desc(resources.updateDate))
    .limit(50)

  const recentFollows = await db
    .select({
      userId: resourceFollows.userId,
      userName: users.username,
      resourceId: resourceFollows.resourceId,
      resourceTitle: resources.title,
      categoryKey: resources.categoryKey,
      createdAt: resourceFollows.createdAt
    })
    .from(resourceFollows)
    .innerJoin(users, eq(resourceFollows.userId, users.id))
    .innerJoin(resources, eq(resourceFollows.resourceId, resources.id))
    .orderBy(desc(resourceFollows.createdAt))
    .limit(100)

  const [totalFollowsRow] = await db
    .select({ value: count(resourceFollows.userId) })
    .from(resourceFollows)

  return {
    topResources: topResources.map(r => ({
      ...r,
      followersCount: Number(r.followersCount ?? 0)
    })),
    recentFollows,
    totalFollows: Number(totalFollowsRow?.value ?? 0)
  }
})

