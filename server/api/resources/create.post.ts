import { desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { categoryFields, resourceCategories, resourceFieldValues, resourceFields, resourceUpdates, resourceVersionFieldValues, resourceVersions, resources } from '../../database/schema'
import { useDb } from '../../utils/db'
import { requireGeemcPublish } from '../../utils/requireGeemcPublish'
import { recalcAndUpdateCategoryLastResource } from '../../utils/resourceCategoryStats'
import { normalizeResourceFieldChoices } from '../../utils/resourceFieldChoices'

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function isStoredFilePath(value: string): boolean {
  return value.startsWith('/api/files/')
}

function validateFieldByMatchType(value: string, matchType: string, matchParams: Record<string, string>): boolean {
  if (!value) return true
  switch (matchType) {
    case 'none':
      return true
    case 'number':
      return /^\d+$/.test(value)
    case 'alphanumeric':
      return /^[a-zA-Z0-9_ -]+$/.test(value)
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    case 'url':
      return isHttpUrl(value)
    case 'regex': {
      const pattern = String(matchParams?.regex || '').trim()
      if (!pattern) return true
      try {
        const re = new RegExp(pattern)
        return re.test(value)
      } catch {
        return true
      }
    }
    default:
      return true
  }
}

function parseChoiceValues(value: string, fieldType: string): string[] {
  if (fieldType === 'multiselect' || fieldType === 'checkbox') {
    return value.split(',').map(x => x.trim()).filter(Boolean)
  }
  return [value]
}

const payloadSchema = z.object({
  title: z.string().min(1).max(255),
  tagLine: z.string().max(255).optional(),
  categoryId: z.number().int().positive(),
  resourceType: z.enum(['download', 'external', 'external_purchase', 'fileless']),
  edition: z.string().min(1).default('java'),
  kind: z.string().min(1).default('mod'),
  environment: z.string().min(1).default('both'),
  description: z.string().min(1),
  cover: z.string().optional().refine(
    value => value === undefined || value === '' || isHttpUrl(value) || isStoredFilePath(value),
    'Invalid cover URL'
  ),
  icon: z.string().optional().refine(
    value => value === undefined || value === '' || isHttpUrl(value) || isStoredFilePath(value),
    'Invalid icon URL'
  ),
  supportUrl: z.string().url().optional(),
  externalUrl: z.string().url().optional(),
  externalPurchaseUrl: z.string().url().optional(),
  price: z.number().int().min(0).optional(),
  currency: z.string().max(8).optional(),
  versionName: z.string().max(255).optional(),
  versionType: z.enum(['release', 'beta', 'alpha']).default('release'),
  size: z.string().max(64).optional(),
  gameVersions: z.array(z.string()).default([]),
  loaders: z.array(z.string()).default([]),
  serverTypes: z.array(z.string()).default([]),
  customFields: z.record(z.string(), z.string()).default({}),
  versionCustomFields: z.record(z.string(), z.string()).default({})
})

export default defineEventHandler(async (event) => {
  const user = await requireGeemcPublish(event)
  const db = await useDb()
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
  const existingIds = await db.select({ id: resources.id }).from(resources)
  const maxNumericId = existingIds.reduce((max, row) => {
    const raw = String(row.id ?? '').trim()
    if (!raw || !/^\d+$/.test(raw)) return max
    const numeric = Number.parseInt(raw, 10)
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max
  }, 0)
  const resourceId = String(maxNumericId + 1)
  let latestVersionId: number | null = null

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
    cover: p.cover || '',
    icon: p.icon || '',
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

  if (p.resourceType === 'download') {
    await db.insert(resourceVersions).values({
      resourceId,
      name: p.versionName?.trim() || '1.0.0',
    type: p.versionType,
      date: now,
      size: p.size?.trim() || '',
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
      latestVersionId = latestVersion.id
      await db
        .update(resources)
        .set({
          currentVersionId: latestVersion.id,
          descriptionUpdateId: descriptionUpdate?.id ?? 0
        })
        .where(eq(resources.id, resourceId))
    }
  } else {
    await db
      .update(resources)
      .set({
        descriptionUpdateId: descriptionUpdate?.id ?? 0
      })
      .where(eq(resources.id, resourceId))
  }

  const links = await db.select().from(categoryFields).where(eq(categoryFields.categoryId, category.id))
  const fieldIds = links.map(x => x.fieldId)
  if (fieldIds.length > 0) {
    const defs = await db
      .select({
        id: resourceFields.id,
        title: resourceFields.title,
        required: resourceFields.required,
        fieldType: resourceFields.fieldType,
        fieldScope: resourceFields.fieldScope,
        fieldChoices: resourceFields.fieldChoices,
        maxLength: resourceFields.maxLength,
        matchType: resourceFields.matchType,
        matchParams: resourceFields.matchParams
      })
      .from(resourceFields)
      .where(inArray(resourceFields.id, fieldIds))
    const defMap = new Map(defs.map(d => [d.id, d]))
    const validateFieldValues = async (
      scope: 'resource' | 'version',
      sourceValues: Record<string, string>,
      saveValue: (fieldId: string, value: string) => Promise<void>
    ) => {
      for (const fid of fieldIds) {
        const def = defMap.get(fid)
        if (!def || (def.fieldScope ?? 'resource') !== scope) continue
        const v = String(sourceValues[fid] ?? '').trim()
        if (def.required && !v) {
          throw createError({ statusCode: 400, statusMessage: `Required field missing: ${fid}` })
        }
        if (!v) continue
        if (def.fieldType === 'select') {
          const choiceKeys = Object.keys(normalizeResourceFieldChoices(def.fieldChoices))
          if (choiceKeys.length > 0 && !choiceKeys.includes(v)) {
            throw createError({ statusCode: 400, statusMessage: `Invalid field choice: ${fid}` })
          }
        }
        if (def.fieldType === 'radio' || def.fieldType === 'multiselect' || def.fieldType === 'checkbox') {
          const choiceKeys = Object.keys(normalizeResourceFieldChoices(def.fieldChoices))
          const selected = parseChoiceValues(v, def.fieldType)
          if (choiceKeys.length > 0 && selected.some(choice => !choiceKeys.includes(choice))) {
            throw createError({ statusCode: 400, statusMessage: `Invalid field choice: ${fid}` })
          }
        }
        if (Number(def.maxLength || 0) > 0 && v.length > Number(def.maxLength)) {
          throw createError({ statusCode: 400, statusMessage: `Field too long: ${fid}` })
        }
        if (!validateFieldByMatchType(v, def.matchType, def.matchParams || {})) {
          throw createError({ statusCode: 400, statusMessage: `Invalid field format: ${fid}` })
        }
        await saveValue(fid, v)
      }
    }

    await validateFieldValues('resource', p.customFields, async (fieldId, value) => {
      await db.insert(resourceFieldValues).values({
        resourceId,
        fieldId,
        fieldValue: value
      })
    })

    if (p.resourceType === 'download' && latestVersionId) {
      await validateFieldValues('version', p.versionCustomFields, async (fieldId, value) => {
        await db.insert(resourceVersionFieldValues).values({
          resourceVersionId: latestVersionId,
          fieldId,
          fieldValue: value
        })
      })
    }
  }

  await recalcAndUpdateCategoryLastResource(db, category.slug)

  return {
    success: true,
    resourceId,
    versionId: latestVersionId,
    redirectTo: `/resources/${resourceId}`
  }
})
