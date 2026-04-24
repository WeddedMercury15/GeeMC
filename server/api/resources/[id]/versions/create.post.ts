import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { resourceUpdates, resourceVersions, resources } from '../../../../database/schema'
import { useDb } from '../../../../utils/db'
import { requireGeemcPublish } from '../../../../utils/requireGeemcPublish'
import { recalcAndUpdateCategoryLastResource } from '../../../../utils/resourceCategoryStats'
import { encodeNotificationMessage, notifyResourceFollowers } from '../../../../utils/resourceFollowNotifications'
import { canManageResourceByTeam } from '../../../../utils/resourceTeam'

const payloadSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['release', 'snapshot']).default('release'),
  size: z.string().min(1).max(64).default('0 MB'),
  gameVersions: z.array(z.string()).default([]),
  loaders: z.array(z.string()).default([]),
  serverTypes: z.array(z.string()).default([]),
  updateTitle: z.string().max(255).default(''),
  updateMessage: z.string().min(1),
  updateType: z.enum(['update', 'release', 'snapshot']).default('release')
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

  await db.insert(resourceVersions).values({
    resourceId,
    name: p.name,
    type: p.type,
    date: now,
    size: p.size,
    hash: null,
    gameVersions: p.gameVersions,
    loaders: p.loaders,
    serverTypes: p.serverTypes
  })

  const [latestVersion] = await db
    .select({ id: resourceVersions.id })
    .from(resourceVersions)
    .where(eq(resourceVersions.resourceId, resourceId))
    .orderBy(desc(resourceVersions.id))
    .limit(1)

  await db.insert(resourceUpdates).values({
    resourceId,
    resourceVersionId: latestVersion?.id ?? null,
    title: p.updateTitle ?? '',
    message: p.updateMessage,
    messageHtml: p.updateMessage,
    postDate: now,
    updateType: p.updateType,
    isDescription: false,
    versionString: p.name,
    messageState: 'visible'
  })

  await db
    .update(resources)
    .set({
      currentVersionId: latestVersion?.id ?? 0,
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
    type: 'resource_version',
    title: resourceRow.title,
    message: encodeNotificationMessage({
      text: `New version published: ${p.name}`,
      target: latestVersion?.id ? { tab: 'versions', anchor: `version-${latestVersion.id}` } : { tab: 'versions' }
    })
  })

  return { success: true }
})

