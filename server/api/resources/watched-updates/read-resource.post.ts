import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { resourceFollows, resourceUpdates, resources } from '../../../database/schema'
import { getCurrentUser } from '../../../utils/auth'
import { useDb } from '../../../utils/db'

const payloadSchema = z.object({
  updateId: z.number().int().positive()
})

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const parsed = payloadSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  }

  const db = await useDb()
  const [row] = await db
    .select({
      resourceId: resourceFollows.resourceId,
      currentLastReadAt: resourceFollows.lastReadAt,
      updatePostDate: resourceUpdates.postDate
    })
    .from(resourceFollows)
    .innerJoin(resources, eq(resourceFollows.resourceId, resources.id))
    .innerJoin(resourceUpdates, eq(resourceUpdates.resourceId, resources.id))
    .where(and(
      eq(resourceFollows.userId, user.id),
      eq(resourceUpdates.id, parsed.data.updateId),
      eq(resources.resourceState, 'visible'),
      eq(resourceUpdates.messageState, 'visible'),
      eq(resourceUpdates.isDescription, false)
    ))
    .limit(1)
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Update not found' })
  }

  const nextReadAt = !row.currentLastReadAt || row.updatePostDate > row.currentLastReadAt
    ? row.updatePostDate
    : row.currentLastReadAt

  await db
    .update(resourceFollows)
    .set({ lastReadAt: nextReadAt })
    .where(and(eq(resourceFollows.userId, user.id), eq(resourceFollows.resourceId, row.resourceId)))

  return { success: true, readAt: nextReadAt }
})
