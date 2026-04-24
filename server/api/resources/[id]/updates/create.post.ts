import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { resourceUpdates, resources } from '../../../../database/schema'
import { useDb } from '../../../../utils/db'
import { requireGeemcPublish } from '../../../../utils/requireGeemcPublish'
import { recalcAndUpdateCategoryLastResource } from '../../../../utils/resourceCategoryStats'
import { encodeNotificationMessage, notifyResourceFollowers } from '../../../../utils/resourceFollowNotifications'
import { canManageResourceByTeam } from '../../../../utils/resourceTeam'

const payloadSchema = z.object({
  title: z.string().max(255).default(''),
  versionString: z.string().max(255).default(''),
  updateType: z.enum(['update', 'release', 'snapshot']).default('update'),
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
      teamMemberUserIds: resources.teamMemberUserIds,
      updateCount: resources.updateCount
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
  const p = parsed.data

  await db.insert(resourceUpdates).values({
    resourceId,
    title: p.title ?? '',
    message: p.message,
    messageHtml: p.message,
    postDate: now,
    updateType: p.updateType,
    isDescription: false,
    versionString: p.versionString ?? '',
    messageState: 'visible'
  })

  const [latestUpdate] = await db
    .select({ id: resourceUpdates.id })
    .from(resourceUpdates)
    .where(eq(resourceUpdates.resourceId, resourceId))
    .orderBy(desc(resourceUpdates.id))
    .limit(1)

  await db
    .update(resources)
    .set({
      updateCount: (resourceRow.updateCount ?? 0) + 1,
      lastUpdate: now,
      updateDate: now
    })
    .where(eq(resources.id, resourceId))

  await recalcAndUpdateCategoryLastResource(db, resourceRow.categoryKey)
  await notifyResourceFollowers({
    db,
    actorUserId: Number(user.id),
    resourceId,
    type: 'resource_update',
    title: resourceRow.title,
    message: encodeNotificationMessage({
      text: p.title?.trim() ? p.title : 'Resource update published',
      target: latestUpdate?.id ? { tab: 'changelog', anchor: `update-${latestUpdate.id}` } : { tab: 'changelog' }
    })
  })

  return { success: true }
})

