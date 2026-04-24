import { and, eq } from 'drizzle-orm'
import { resourceFollows } from '../../../database/schema'
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
  await db
    .delete(resourceFollows)
    .where(and(eq(resourceFollows.resourceId, resourceId), eq(resourceFollows.userId, user.id)))

  await recalcAndUpdateResourceFollowersCount(db, resourceId)
  return { success: true, following: false }
})

