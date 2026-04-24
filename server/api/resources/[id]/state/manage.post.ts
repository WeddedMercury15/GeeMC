import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { resources } from '../../../../database/schema'
import { useDb } from '../../../../utils/db'
import { requireGeemcPublish } from '../../../../utils/requireGeemcPublish'
import { changeResourceState, resolveStateByIntent } from '../../../../utils/resourceStateService'
import { canManageResourceByTeam } from '../../../../utils/resourceTeam'

const payloadSchema = z.object({
  intent: z.enum(['hide', 'restore', 'delete']),
  reason: z.string().max(1000).optional()
})

export default defineEventHandler(async (event) => {
  const user = await requireGeemcPublish(event)
  const resourceId = getRouterParam(event, 'id')
  if (!resourceId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

  const parsed = payloadSchema.safeParse(await readBody(event))
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
      resourceState: resources.resourceState
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

  const intent = parsed.data.intent
  const reason = parsed.data.reason
  const nextState = resolveStateByIntent(intent)
  const source = Number(resourceRow.authorUserId) === Number(user.id) ? 'owner_self' : 'team_member'
  await changeResourceState({
    db,
    resourceId,
    actorUserId: Number(user.id),
    action: intent === 'hide' ? 'hide' : intent === 'delete' ? 'delete' : 'restore',
    source,
    nextState,
    reason
  })

  return { success: true, resourceState: nextState }
})

