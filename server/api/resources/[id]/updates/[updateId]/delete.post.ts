import { and, desc, eq } from 'drizzle-orm'
import { resourceUpdates, resources } from '../../../../../database/schema'
import { useDb } from '../../../../../utils/db'
import { requireGeemcPublish } from '../../../../../utils/requireGeemcPublish'
import { recalcAndUpdateCategoryLastResource } from '../../../../../utils/resourceCategoryStats'
import { canManageResourceByTeam } from '../../../../../utils/resourceTeam'

async function recalcUpdateStats(db: Awaited<ReturnType<typeof useDb>>, resourceId: string) {
  const visibleUpdates = await db
    .select({ id: resourceUpdates.id, postDate: resourceUpdates.postDate })
    .from(resourceUpdates)
    .where(and(eq(resourceUpdates.resourceId, resourceId), eq(resourceUpdates.isDescription, false), eq(resourceUpdates.messageState, 'visible')))
    .orderBy(desc(resourceUpdates.postDate), desc(resourceUpdates.id))

  const count = visibleUpdates.length
  const last = visibleUpdates[0]?.postDate
  return { count, last }
}

export default defineEventHandler(async (event) => {
  const user = await requireGeemcPublish(event)
  const resourceId = getRouterParam(event, 'id')
  const updateIdRaw = getRouterParam(event, 'updateId')
  const updateId = Number(updateIdRaw)

  if (!resourceId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }
  if (!updateIdRaw || !Number.isFinite(updateId) || updateId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid updateId' })
  }

  const db = await useDb()
  const [resourceRow] = await db
    .select({
      authorUserId: resources.authorUserId,
      teamMemberUserIds: resources.teamMemberUserIds,
      title: resources.title,
      categoryKey: resources.categoryKey
    })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)

  if (!resourceRow) {
    throw createError({ statusCode: 404, statusMessage: 'Resource not found' })
  }
  if (!canManageResourceByTeam({
    authorUserId: resourceRow.authorUserId,
    teamMemberUserIds: resourceRow.teamMemberUserIds,
    userId: user.id
  })) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const [existing] = await db
    .select({
      id: resourceUpdates.id,
      messageState: resourceUpdates.messageState,
      isDescription: resourceUpdates.isDescription
    })
    .from(resourceUpdates)
    .where(and(eq(resourceUpdates.id, updateId), eq(resourceUpdates.resourceId, resourceId)))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Update not found' })
  }

  if (existing.messageState !== 'visible') {
    return { success: true }
  }

  if (existing.isDescription) {
    throw createError({ statusCode: 400, statusMessage: 'Description updates are immutable' })
  }

  await db
    .update(resourceUpdates)
    .set({ messageState: 'deleted' })
    .where(and(eq(resourceUpdates.id, updateId), eq(resourceUpdates.resourceId, resourceId)))

  const now = new Date().toISOString()
  const stats = await recalcUpdateStats(db, resourceId)

  await db
    .update(resources)
    .set({
      updateCount: stats.count,
      lastUpdate: stats.last ?? now,
      updateDate: stats.last ?? now
    })
    .where(eq(resources.id, resourceId))

  await recalcAndUpdateCategoryLastResource(db, resourceRow.categoryKey)

  return { success: true }
})

