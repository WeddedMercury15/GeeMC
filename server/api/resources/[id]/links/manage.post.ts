import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { resourceLinks, resources } from '../../../../database/schema'
import { useDb } from '../../../../utils/db'
import { requireGeemcPublish } from '../../../../utils/requireGeemcPublish'
import { canManageResourceByTeam } from '../../../../utils/resourceTeam'

const payloadSchema = z.object({
  action: z.enum(['add', 'update', 'delete', 'bulk_replace']),
  id: z.number().int().positive().optional(),
  ids: z.array(z.number().int().positive()).optional(),
  label: z.string().min(1).max(255).optional(),
  url: z.string().url().optional(),
  icon: z.string().min(1).max(255).optional(),
  type: z.string().max(100).optional(),
  items: z.array(z.object({
    label: z.string().min(1).max(255),
    url: z.string().url(),
    icon: z.string().min(1).max(255),
    type: z.string().max(100).optional()
  })).optional()
})

export default defineEventHandler(async (event) => {
  const user = await requireGeemcPublish(event)
  const resourceId = getRouterParam(event, 'id')
  if (!resourceId) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const parsed = payloadSchema.safeParse(await readBody(event))
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
    if (!p.label || !p.url || !p.icon) throw createError({ statusCode: 400, statusMessage: 'Missing fields' })
    await db.insert(resourceLinks).values({ resourceId, label: p.label, url: p.url, icon: p.icon, type: p.type ?? null })
    return { success: true }
  }

  if (p.action === 'update') {
    if (!p.id || !p.label || !p.url || !p.icon) throw createError({ statusCode: 400, statusMessage: 'Missing fields' })
    await db
      .update(resourceLinks)
      .set({ label: p.label, url: p.url, icon: p.icon, type: p.type ?? null })
      .where(and(eq(resourceLinks.id, p.id), eq(resourceLinks.resourceId, resourceId)))
    return { success: true }
  }

  if (p.action === 'delete') {
    const ids = p.ids ?? (p.id ? [p.id] : [])
    if (!ids || ids.length === 0) throw createError({ statusCode: 400, statusMessage: 'Missing id(s)' })
    await db
      .delete(resourceLinks)
      .where(and(eq(resourceLinks.resourceId, resourceId), inArray(resourceLinks.id, ids)))
    return { success: true }
  }

  const items = p.items ?? []
  await db.delete(resourceLinks).where(eq(resourceLinks.resourceId, resourceId))
  if (items.length > 0) {
    await db.insert(resourceLinks).values(items.map(it => ({
      resourceId,
      label: it.label,
      url: it.url,
      icon: it.icon,
      type: it.type ?? null
    })))
  }
  return { success: true }
})
