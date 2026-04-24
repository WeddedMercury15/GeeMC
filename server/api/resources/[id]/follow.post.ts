import { and, eq } from 'drizzle-orm'
import { resourceFollows, resources } from '../../../database/schema'
import { getCurrentUser } from '../../../utils/auth'
import { useDb } from '../../../utils/db'
import { recalcAndUpdateResourceFollowersCount } from '../../../utils/resourceFollowStats'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const resourceId = getRouterParam(event, 'id')
  if (!resourceId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

  const db = await useDb()
  const [resourceRow] = await db
    .select({
      id: resources.id,
      resourceState: resources.resourceState
    })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)
  if (!resourceRow) {
    throw createError({ statusCode: 404, statusMessage: 'Resource not found' })
  }
  if (resourceRow.resourceState !== 'visible') {
    throw createError({ statusCode: 403, statusMessage: 'Cannot follow non-visible resource' })
  }

  const [existing] = await db
    .select({ userId: resourceFollows.userId })
    .from(resourceFollows)
    .where(and(eq(resourceFollows.resourceId, resourceId), eq(resourceFollows.userId, user.id)))
    .limit(1)
  if (!existing) {
    await db.insert(resourceFollows).values({
      userId: user.id,
      resourceId,
      createdAt: new Date().toISOString(),
      lastReadAt: ''
    })
    await recalcAndUpdateResourceFollowersCount(db, resourceId)
  }

  return { success: true, following: true }
})
