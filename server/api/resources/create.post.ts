import { desc, eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { categoryFields, resourceCategories, resourceFieldValues, resourceFields, resourceUpdates, resourceVersions, resources } from '../../database/schema'
import { useDb } from '../../utils/db'
import { requireGeemcPublish } from '../../utils/requireGeemcPublish'
import { recalcAndUpdateCategoryLastResource } from '../../utils/resourceCategoryStats'

const payloadSchema = z.object({
  title: z.string().min(1).max(255),
  tagLine: z.string().max(255).optional(),
  categoryId: z.number().int().positive(),
  resourceType: z.enum(['download', 'external', 'external_purchase', 'fileless']),
  edition: z.string().min(1).default('java'),
  kind: z.string().min(1).default('mod'),
  environment: z.string().min(1).default('both'),
  description: z.string().min(1),
  cover: z.string().url(),
  icon: z.string().url(),
  supportUrl: z.string().url().optional(),
  externalUrl: z.string().url().optional(),
  externalPurchaseUrl: z.string().url().optional(),
  price: z.number().int().min(0).optional(),
  currency: z.string().max(8).optional(),
  versionName: z.string().min(1).max(255),
  versionType: z.enum(['release', 'snapshot']).default('release'),
  size: z.string().min(1).max(64),
  gameVersions: z.array(z.string()).default([]),
  loaders: z.array(z.string()).default([]),
  serverTypes: z.array(z.string()).default([]),
  customFields: z.record(z.string(), z.string()).default({})
})

export default defineEventHandler(async (event) => {
  const user = await requireGeemcPublish(event)
  const db = await useDb()
  const body = await readBody(event)
  const parsed = payloadSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  }
  const p = parsed.data

  const [category] = await db
    .select()
    .from(resourceCategories)
    .where(eq(resourceCategories.id, p.categoryId))
    .limit(1)

  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }

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
  const resourceId = `res_${randomUUID().replace(/-/g, '').slice(0, 20)}`

  await db.insert(resources).values({
    id: resourceId,
    title: p.title,
    tagLine: p.tagLine ?? '',
    categoryKey: category.slug,
    platformKey: p.edition,
    edition: p.edition,
    kind: p.kind,
    environment: p.environment,
    resourceType: p.resourceType,
    resourceState: 'visible',
    externalUrl: p.externalUrl ?? '',
    externalPurchaseUrl: p.externalPurchaseUrl ?? '',
    price: p.price ?? 0,
    currency: p.currency ?? '',
    currentVersionId: 0,
    descriptionUpdateId: 0,
    viewCount: 0,
    updateCount: 0,
    reviewCount: 0,
    lastUpdate: now,
    supportUrl: p.supportUrl ?? '',
    customFields: p.customFields,
    prefixId: 0,
    iconDate: '0',
    featured: false,
    teamMemberUserIds: [],
    description: p.description,
    descriptionHtml: p.description,
    cover: p.cover,
    icon: p.icon,
    authorUserId: Number(user.id),
    createDate: now,
    updateDate: now,
    publishedAt: now,
    tags: [],
    licenseName: null,
    licenseUrl: null
  })

  await db.insert(resourceUpdates).values({
    resourceId,
    title: 'Description',
    message: p.description,
    messageHtml: p.description,
    postDate: now,
    updateType: 'description',
    isDescription: true,
    versionString: '',
    messageState: 'visible'
  })

  const [descriptionUpdate] = await db
    .select({ id: resourceUpdates.id })
    .from(resourceUpdates)
    .where(eq(resourceUpdates.resourceId, resourceId))
    .orderBy(desc(resourceUpdates.id))
    .limit(1)

  await db.insert(resourceVersions).values({
    resourceId,
    name: p.versionName,
    type: p.versionType,
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

  if (latestVersion) {
    await db
      .update(resources)
      .set({
        currentVersionId: latestVersion.id,
        descriptionUpdateId: descriptionUpdate?.id ?? 0
      })
      .where(eq(resources.id, resourceId))
  }

  const links = await db.select().from(categoryFields).where(eq(categoryFields.categoryId, category.id))
  const fieldIds = links.map(x => x.fieldId)
  if (fieldIds.length > 0) {
    const defs = await db
      .select({ id: resourceFields.id, required: resourceFields.required })
      .from(resourceFields)
      .where(inArray(resourceFields.id, fieldIds))
    const defMap = new Map(defs.map(d => [d.id, d]))
    for (const fid of fieldIds) {
      const v = p.customFields[fid]
      const def = defMap.get(fid)
      if (def?.required && !v?.trim()) {
        throw createError({ statusCode: 400, statusMessage: `Required field missing: ${fid}` })
      }
      if (v?.trim()) {
        await db.insert(resourceFieldValues).values({
          resourceId,
          fieldId: fid,
          fieldValue: v.trim()
        })
      }
    }
  }

  await recalcAndUpdateCategoryLastResource(db, category.slug)

  return {
    success: true,
    resourceId,
    redirectTo: `/${category.slug}/${resourceId}`
  }
})
