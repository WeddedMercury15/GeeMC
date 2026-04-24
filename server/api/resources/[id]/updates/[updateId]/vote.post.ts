import { and, eq } from 'drizzle-orm'
import { resourceUpdates, resourceUpdateVotes } from '../../../../../../database/schema'
import { getCurrentUser } from '../../../../../../utils/auth'
import { useDb } from '../../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const resourceId = getRouterParam(event, 'id')
  const updateId = Number(getRouterParam(event, 'updateId'))
  if (!resourceId || !Number.isFinite(updateId) || updateId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid params' })
  }

  const db = await useDb()
  const [updateRow] = await db
    .select({
      id: resourceUpdates.id,
      messageState: resourceUpdates.messageState,
      isDescription: resourceUpdates.isDescription
    })
    .from(resourceUpdates)
    .where(and(eq(resourceUpdates.id, updateId), eq(resourceUpdates.resourceId, resourceId)))
    .limit(1)
  if (!updateRow || updateRow.messageState !== 'visible' || updateRow.isDescription) {
    throw createError({ statusCode: 404, statusMessage: 'Update not found' })
  }

  const [existingVote] = await db
    .select({ updateId: resourceUpdateVotes.updateId })
    .from(resourceUpdateVotes)
    .where(and(eq(resourceUpdateVotes.updateId, updateId), eq(resourceUpdateVotes.userId, user.id)))
    .limit(1)
  if (existingVote) {
    await db
      .delete(resourceUpdateVotes)
      .where(and(eq(resourceUpdateVotes.updateId, updateId), eq(resourceUpdateVotes.userId, user.id)))
    return { success: true, voted: false }
  }

  await db.insert(resourceUpdateVotes).values({
    updateId,
    userId: user.id,
    createdAt: new Date().toISOString()
  })
  return { success: true, voted: true }
})
