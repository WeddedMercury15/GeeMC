import { eq, sql } from 'drizzle-orm'
import { resources } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { getCurrentUser } from '../../../utils/auth'
import { shouldCountResourceView } from '../../../utils/resourceViewThrottle'

export default defineEventHandler(async (event) => {
  const resourceId = getRouterParam(event, 'id')
  if (!resourceId) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const user = await getCurrentUser(event)
  const ip = (getRequestHeader(event, 'x-forwarded-for') || '').split(',')[0]?.trim()
  const ua = getRequestHeader(event, 'user-agent') || ''
  const actorKey = user ? `u:${user.id}` : `g:${ip || 'noip'}:${ua.slice(0, 80)}`
  if (!shouldCountResourceView({ resourceId, actorKey, windowMs: 10 * 60 * 1000 })) {
    return { success: true, skipped: true }
  }

  const db = await useDb()
  const [row] = await db
    .select({ id: resources.id })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Resource not found' })

  await db
    .update(resources)
    .set({ viewCount: sql`${resources.viewCount} + 1` })
    .where(eq(resources.id, resourceId))

  return { success: true, skipped: false }
})

