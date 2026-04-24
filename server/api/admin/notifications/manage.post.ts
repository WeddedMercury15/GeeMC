import { inArray } from 'drizzle-orm'
import { z } from 'zod'
import { userNotifications } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { requireGeemcAdmin } from '../../../utils/requireGeemcAdmin'

const payloadSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  action: z.enum(['read', 'unread', 'delete'])
})

export default defineEventHandler(async (event) => {
  await requireGeemcAdmin(event)
  const parsed = payloadSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  const { ids, action } = parsed.data
  const db = await useDb()
  const targetIds = Array.from(new Set(ids))

  if (action === 'delete') {
    await db.delete(userNotifications).where(inArray(userNotifications.id, targetIds))
    return { success: true, changed: targetIds.length }
  }

  const now = new Date().toISOString()
  await db
    .update(userNotifications)
    .set({ readAt: action === 'read' ? now : '' })
    .where(inArray(userNotifications.id, targetIds))

  return { success: true, changed: targetIds.length }
})

