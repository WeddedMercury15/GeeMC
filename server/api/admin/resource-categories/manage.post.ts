import { eq, ne, and, count } from 'drizzle-orm'
import { z } from 'zod'
import { resourceCategories, resources, resourceTemplates } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { requireGeemcAdmin } from '../../../utils/requireGeemcAdmin'
import { ensureDefaultResourceTemplates } from '../../../utils/resourceTemplates'

const manageSchema = z.object({
  intent: z.enum(['create', 'update', 'delete']),
  categoryId: z.number().optional(),
  data: z
    .object({
      name: z.string().min(1),
      slug: z.string().optional(),
      description: z.string().optional(),
      templateId: z.number().int().positive(),
      allowLocal: z.boolean().optional(),
      allowExternal: z.boolean().optional(),
      allowCommercialExternal: z.boolean().optional(),
      allowFileless: z.boolean().optional(),
      alwaysModerateCreate: z.boolean().optional(),
      alwaysModerateUpdate: z.boolean().optional(),
      enableVersioning: z.boolean().optional(),
      enableSupportUrl: z.boolean().optional(),
      requirePrefix: z.boolean().optional(),
      minTags: z.number().int().min(0).optional(),
      parentCategoryId: z.number().int().min(0).optional(),
      displayOrder: z.number().int().min(1).optional()
    })
    .optional()
})

function toSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function resolveSlug(slug: string | undefined, name: string): string {
  const s = slug?.trim() ? toSlug(slug) : toSlug(name)
  if (!s) {
    throw createError({ statusCode: 400, message: 'Invalid slug' })
  }
  return s
}

export default defineEventHandler(async (event) => {
  await requireGeemcAdmin(event)
  const db = await useDb()

  await ensureDefaultResourceTemplates(db)

  const body = await readBody(event)
  const result = manageSchema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Invalid input' })
  }

  const { intent, categoryId, data } = result.data

  if (intent === 'delete') {
    if (!categoryId) {
      throw createError({ statusCode: 400, message: 'Missing categoryId' })
    }

    const [category] = await db
      .select({ slug: resourceCategories.slug })
      .from(resourceCategories)
      .where(eq(resourceCategories.id, categoryId))
      .limit(1)

    if (!category) {
      return { success: false, error: 'Category not found' }
    }

    const [resourcesCount] = await db
      .select({ c: count(resources.id) })
      .from(resources)
      .where(eq(resources.categoryKey, category.slug))

    if (Number(resourcesCount?.c ?? 0) > 0) {
      return { success: false, error: 'Category has resources' }
    }

    await db.delete(resourceCategories).where(eq(resourceCategories.id, categoryId))
    return { success: true, message: 'deleteSuccess' }
  }

  if (!data) {
    throw createError({ statusCode: 400, message: 'Missing data' })
  }

  const templateExists = await db
    .select({ id: resourceTemplates.id })
    .from(resourceTemplates)
    .where(eq(resourceTemplates.id, data.templateId))
    .limit(1)

  if (templateExists.length === 0) {
    return { success: false, error: 'Template not found' }
  }

  const newSlug = resolveSlug(data.slug, data.name)

  if (intent === 'create') {
    const existed = await db
      .select({ id: resourceCategories.id })
      .from(resourceCategories)
      .where(eq(resourceCategories.slug, newSlug))
      .limit(1)

    if (existed.length > 0) {
      return { success: false, error: 'Slug already exists' }
    }

    await db.insert(resourceCategories).values({
      name: data.name,
      slug: newSlug,
      description: data.description,
      fieldCache: [],
      reviewFieldCache: [],
      prefixCache: [],
      allowLocal: data.allowLocal ?? true,
      allowExternal: data.allowExternal ?? true,
      allowCommercialExternal: data.allowCommercialExternal ?? false,
      allowFileless: data.allowFileless ?? true,
      alwaysModerateCreate: data.alwaysModerateCreate ?? false,
      alwaysModerateUpdate: data.alwaysModerateUpdate ?? false,
      enableVersioning: data.enableVersioning ?? true,
      enableSupportUrl: data.enableSupportUrl ?? true,
      requirePrefix: data.requirePrefix ?? false,
      minTags: data.minTags ?? 0,
      parentCategoryId: data.parentCategoryId ?? 0,
      displayOrder: data.displayOrder ?? 1,
      templateId: data.templateId
    })

    return { success: true, message: 'createSuccess' }
  }

  if (intent === 'update') {
    if (!categoryId) {
      throw createError({ statusCode: 400, message: 'Missing categoryId' })
    }

    const [category] = await db
      .select({ id: resourceCategories.id, slug: resourceCategories.slug })
      .from(resourceCategories)
      .where(eq(resourceCategories.id, categoryId))
      .limit(1)

    if (!category) {
      return { success: false, error: 'Category not found' }
    }

    if (category.slug !== newSlug) {
      const slugOther = await db
        .select({ id: resourceCategories.id })
        .from(resourceCategories)
        .where(and(eq(resourceCategories.slug, newSlug), ne(resourceCategories.id, categoryId)))
        .limit(1)

      if (slugOther.length > 0) {
        return { success: false, error: 'Slug already exists' }
      }
    }

    await db
      .update(resourceCategories)
      .set({
        name: data.name,
        slug: newSlug,
        description: data.description,
        allowLocal: data.allowLocal ?? true,
        allowExternal: data.allowExternal ?? true,
        allowCommercialExternal: data.allowCommercialExternal ?? false,
        allowFileless: data.allowFileless ?? true,
        alwaysModerateCreate: data.alwaysModerateCreate ?? false,
        alwaysModerateUpdate: data.alwaysModerateUpdate ?? false,
        enableVersioning: data.enableVersioning ?? true,
        enableSupportUrl: data.enableSupportUrl ?? true,
        requirePrefix: data.requirePrefix ?? false,
        minTags: data.minTags ?? 0,
        parentCategoryId: data.parentCategoryId ?? 0,
        displayOrder: data.displayOrder ?? 1,
        templateId: data.templateId
      })
      .where(eq(resourceCategories.id, categoryId))

    if (category.slug !== newSlug) {
      await db.update(resources).set({ categoryKey: newSlug }).where(eq(resources.categoryKey, category.slug))
    }

    return { success: true, message: 'updateSuccess' }
  }

  return { success: false, error: 'Invalid intent' }
})

