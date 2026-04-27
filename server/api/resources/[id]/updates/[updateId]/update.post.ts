import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { resourceUpdates, resources } from '../../../../../database/schema'
import { useDb } from '../../../../../utils/db'
import { requireGeemcPublish } from '../../../../../utils/requireGeemcPublish'
import { canManageResourceByTeam } from '../../../../../utils/resourceTeam'

const payloadSchema = z.object({
  title: z.string().max(255).default(''),
  versionString: z.string().max(255).default(''),
  updateType: z.enum(['update', 'release', 'snapshot']).default('update'),
  message: z.string().min(1)
})

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

  const body = await readBody(event)
  const parsed = payloadSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid input',
      data: {
        code: 'VALIDATION_ERROR',
        details: parsed.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      }
    })
  }

  const db = await useDb()
  const [resourceRow] = await db
    .select({
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

  const [existing] = await db
    .select({
      id: resourceUpdates.id,
      isDescription: resourceUpdates.isDescription,
      messageState: resourceUpdates.messageState
    })
    .from(resourceUpdates)
    .where(and(eq(resourceUpdates.id, updateId), eq(resourceUpdates.resourceId, resourceId)))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Update not found' })
  }
  if (existing.messageState !== 'visible') {
    throw createError({ statusCode: 400, statusMessage: 'Update is not editable' })
  }
  if (existing.isDescription) {
    throw createError({ statusCode: 400, statusMessage: 'Description updates are immutable' })
  }

  const p = parsed.data

  await db
    .update(resourceUpdates)
    .set({
      title: p.title ?? '',
      versionString: p.versionString ?? '',
      updateType: p.updateType,
      message: p.message,
      messageHtml: p.message
    })
    .where(and(eq(resourceUpdates.id, updateId), eq(resourceUpdates.resourceId, resourceId)))

  return { success: true }
})
