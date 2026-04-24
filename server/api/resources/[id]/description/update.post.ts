import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { resourceUpdates, resources } from '../../../../database/schema'
import { useDb } from '../../../../utils/db'
import { requireGeemcPublish } from '../../../../utils/requireGeemcPublish'
import { recalcAndUpdateCategoryLastResource } from '../../../../utils/resourceCategoryStats'
import { encodeNotificationMessage, notifyResourceFollowers } from '../../../../utils/resourceFollowNotifications'
import { canManageResourceByTeam } from '../../../../utils/resourceTeam'

const payloadSchema = z.object({
  message: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const user = await requireGeemcPublish(event)
  const resourceId = getRouterParam(event, 'id')
  if (!resourceId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

  const body = await readBody(event)
  const parsed = payloadSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  }

  const db = await useDb()
  const [resourceRow] = await db
    .select({
      id: resources.id,
      title: resources.title,
      categoryKey: resources.categoryKey,
      authorUserId: resources.authorUserId,
      teamMemberUserIds: resources.teamMemberUserIds
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

  const now = new Date().toISOString()
  const message = parsed.data.message

  await db.insert(resourceUpdates).values({
    resourceId,
    title: 'Description',
    message,
    messageHtml: message,
    postDate: now,
    updateType: 'description',
    isDescription: true,
    versionString: '',
    messageState: 'visible'
  })

  const [latestDescUpdate] = await db
    .select({ id: resourceUpdates.id })
    .from(resourceUpdates)
    .where(eq(resourceUpdates.resourceId, resourceId))
    .orderBy(desc(resourceUpdates.id))
    .limit(1)

  await db
    .update(resources)
    .set({
      description: message,
      descriptionHtml: message,
      descriptionUpdateId: latestDescUpdate?.id ?? 0,
      lastUpdate: now,
      updateDate: now
    })
    .where(eq(resources.id, resourceId))

  await recalcAndUpdateCategoryLastResource(db, resourceRow.categoryKey)
  await notifyResourceFollowers({
    db,
    actorUserId: Number(user.id),
    resourceId,
    type: 'resource_description',
    title: resourceRow.title,
    message: encodeNotificationMessage({
      text: 'Resource description updated',
      target: { tab: 'description' }
    })
  })

  return { success: true }
})

