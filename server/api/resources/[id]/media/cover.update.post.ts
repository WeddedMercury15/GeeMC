import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { resources } from '../../../../database/schema'
import { useDb } from '../../../../utils/db'
import { requireGeemcPublish } from '../../../../utils/requireGeemcPublish'
import { canManageResourceByTeam } from '../../../../utils/resourceTeam'

const payloadSchema = z.object({
  cover: z.string().url()
})

export default defineEventHandler(async (event) => {
  const user = await requireGeemcPublish(event)
  const resourceId = getRouterParam(event, 'id')
  if (!resourceId) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const parsed = payloadSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })

  const db = await useDb()
  const [row] = await db
    .select({
      id: resources.id,
      authorUserId: resources.authorUserId,
      teamMemberUserIds: resources.teamMemberUserIds
    })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Resource not found' })

  if (!canManageResourceByTeam({ authorUserId: row.authorUserId, teamMemberUserIds: row.teamMemberUserIds, userId: user.id })) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const now = new Date().toISOString()
  await db
    .update(resources)
    .set({ cover: parsed.data.cover, updateDate: now, lastUpdate: now })
    .where(eq(resources.id, resourceId))

  return { success: true }
})

