import { inArray } from 'drizzle-orm'
import { z } from 'zod'
import { resources } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { requireGeemcAdmin } from '../../../utils/requireGeemcAdmin'
import { changeResourceState, resolveStateByIntent } from '../../../utils/resourceStateService'

const payloadSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  intent: z.enum(['hide', 'restore', 'delete']),
  reason: z.string().max(1000).optional()
})

export default defineEventHandler(async (event) => {
  const adminUser = await requireGeemcAdmin(event)
  const parsed = payloadSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  }

  const { ids, intent, reason } = parsed.data
  const nextState = resolveStateByIntent(intent)

  const db = await useDb()
  const rows = await db
    .select({ id: resources.id, categoryKey: resources.categoryKey, resourceState: resources.resourceState })
    .from(resources)
    .where(inArray(resources.id, ids))

  if (rows.length === 0) return { success: true, changed: 0 }

  const targetIds = rows.filter(r => r.resourceState !== nextState).map(r => r.id)
  if (targetIds.length === 0) return { success: true, changed: 0 }

  const action = intent === 'hide' ? 'hide' : intent === 'delete' ? 'delete' : 'restore'
  let changed = 0
  for (const rid of targetIds) {
    const result = await changeResourceState({
      db,
      resourceId: rid,
      actorUserId: Number(adminUser.id),
      action,
      source: 'admin_batch',
      nextState,
      reason
    })
    if (result.changed) changed++
  }

  return { success: true, changed }
})

