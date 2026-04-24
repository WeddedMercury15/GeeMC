import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { resourceGallery, resources } from '../../../../database/schema'
import { useDb } from '../../../../utils/db'
import { requireGeemcPublish } from '../../../../utils/requireGeemcPublish'
import { canManageResourceByTeam } from '../../../../utils/resourceTeam'

const payloadSchema = z.object({
  action: z.enum(['add', 'update', 'delete', 'bulk_replace']),
  id: z.number().int().positive().optional(),
  ids: z.array(z.number().int().positive()).optional(),
  url: z.string().url().optional(),
  caption: z.string().max(255).optional(),
  items: z.array(z.object({ url: z.string().url(), caption: z.string().max(255).optional() })).optional()
})

export default defineEventHandler(async (event) => {
  const user = await requireGeemcPublish(event)
  const resourceId = getRouterParam(event, 'id')
  if (!resourceId) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const parsed = payloadSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  const p = parsed.data

  const db = await useDb()
  const [row] = await db
    .select({ authorUserId: resources.authorUserId, teamMemberUserIds: resources.teamMemberUserIds })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Resource not found' })
  if (!canManageResourceByTeam({ authorUserId: row.authorUserId, teamMemberUserIds: row.teamMemberUserIds, userId: user.id })) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (p.action === 'add') {
    if (!p.url) throw createError({ statusCode: 400, statusMessage: 'Missing url' })
    await db.insert(resourceGallery).values({ resourceId, url: p.url, caption: p.caption ?? '' })
    return { success: true }
  }

  if (p.action === 'update') {
    if (!p.id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
    if (!p.url) throw createError({ statusCode: 400, statusMessage: 'Missing url' })
    await db
      .update(resourceGallery)
      .set({ url: p.url, caption: p.caption ?? '' })
      .where(and(eq(resourceGallery.id, p.id), eq(resourceGallery.resourceId, resourceId)))
    return { success: true }
  }

  if (p.action === 'delete') {
    const ids = p.ids ?? (p.id ? [p.id] : [])
    if (!ids || ids.length === 0) throw createError({ statusCode: 400, statusMessage: 'Missing id(s)' })
    await db
      .delete(resourceGallery)
      .where(and(eq(resourceGallery.resourceId, resourceId), inArray(resourceGallery.id, ids)))
    return { success: true }
  }

  // bulk_replace: delete then insert in given order
  const items = p.items ?? []
  await db.delete(resourceGallery).where(eq(resourceGallery.resourceId, resourceId))
  if (items.length > 0) {
    await db.insert(resourceGallery).values(items.map(it => ({ resourceId, url: it.url, caption: it.caption ?? '' })))
  }
  return { success: true }
})

