import { eq } from 'drizzle-orm'
import { resourceFollows, resources } from '../database/schema'

type DbLike = {
  select: any
  update: any
}

export async function recalcAndUpdateResourceFollowersCount(db: DbLike, resourceId: string) {
  const rows = await db
    .select({
      userId: resourceFollows.userId
    })
    .from(resourceFollows)
    .where(eq(resourceFollows.resourceId, resourceId))

  await db
    .update(resources)
    .set({
      followersCount: rows.length
    })
    .where(eq(resources.id, resourceId))
}

