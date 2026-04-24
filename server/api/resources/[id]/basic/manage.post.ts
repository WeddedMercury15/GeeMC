import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { resourceCategories, resources } from '../../../../database/schema'
import { getCurrentUser } from '../../../../utils/auth'
import { useDb } from '../../../../utils/db'
import { requireGeemcPublish } from '../../../../utils/requireGeemcPublish'
import { canManageResourceByTeam } from '../../../../utils/resourceTeam'

const payloadSchema = z.object({
  title: z.string().min(1).max(255),
  tagLine: z.string().max(255).default(''),
  resourceType: z.enum(['download', 'external', 'external_purchase', 'fileless']),
  supportUrl: z.string().url().optional(),
  externalUrl: z.string().url().optional(),
  externalPurchaseUrl: z.string().url().optional(),
  price: z.number().int().min(0).optional(),
  currency: z.string().max(8).optional(),
  tags: z.array(z.string().min(1).max(32)).max(50).default([])
})

function normalizeTags(input: string[]) {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of input) {
    const t = String(raw || '').trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
    if (out.length >= 50) break
  }
  return out
}

export default defineEventHandler(async (event) => {
  // only owners/team can edit basic info
  const user = await requireGeemcPublish(event)
  const resourceId = getRouterParam(event, 'id')
  if (!resourceId) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const parsed = payloadSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  const p = parsed.data

  const db = await useDb()
  const [row] = await db
    .select({
      id: resources.id,
      categoryKey: resources.categoryKey,
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

  const [category] = await db
    .select({
      allowLocal: resourceCategories.allowLocal,
      allowExternal: resourceCategories.allowExternal,
      allowCommercialExternal: resourceCategories.allowCommercialExternal,
      allowFileless: resourceCategories.allowFileless
    })
    .from(resourceCategories)
    .where(eq(resourceCategories.slug, row.categoryKey))
    .limit(1)

  if (!category) throw createError({ statusCode: 400, statusMessage: 'Invalid category' })

  if (p.resourceType === 'download' && !category.allowLocal) {
    throw createError({ statusCode: 400, statusMessage: 'Category does not allow local download resources' })
  }
  if (p.resourceType === 'external' && !category.allowExternal) {
    throw createError({ statusCode: 400, statusMessage: 'Category does not allow external resources' })
  }
  if (p.resourceType === 'external_purchase' && !category.allowCommercialExternal) {
    throw createError({ statusCode: 400, statusMessage: 'Category does not allow paid external resources' })
  }
  if (p.resourceType === 'fileless' && !category.allowFileless) {
    throw createError({ statusCode: 400, statusMessage: 'Category does not allow fileless resources' })
  }

  const now = new Date().toISOString()
  const tags = normalizeTags(p.tags)

  await db
    .update(resources)
    .set({
      title: p.title,
      tagLine: p.tagLine ?? '',
      resourceType: p.resourceType,
      supportUrl: p.supportUrl ?? '',
      externalUrl: p.externalUrl ?? '',
      externalPurchaseUrl: p.externalPurchaseUrl ?? '',
      price: p.price ?? 0,
      currency: p.currency ?? '',
      tags,
      updateDate: now,
      lastUpdate: now
    })
    .where(eq(resources.id, resourceId))

  // optional: notify current user for UX; but API just returns success
  await getCurrentUser(event)
  return { success: true }
})

