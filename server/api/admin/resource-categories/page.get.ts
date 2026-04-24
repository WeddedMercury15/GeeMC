import { eq } from 'drizzle-orm'
import { useDb } from '../../../utils/db'
import { requireGeemcAdmin } from '../../../utils/requireGeemcAdmin'
import { resourceCategories, resourceTemplates } from '../../../database/schema'
import { ensureDefaultResourceTemplates } from '../../../utils/resourceTemplates'

export default defineEventHandler(async (event) => {
  await requireGeemcAdmin(event)
  const db = await useDb()

  await ensureDefaultResourceTemplates(db)

  const templates = await db
    .select({
      id: resourceTemplates.id,
      name: resourceTemplates.name,
      key: resourceTemplates.key,
      cardAspectRatio: resourceTemplates.cardAspectRatio
    })
    .from(resourceTemplates)
    .orderBy(resourceTemplates.id)

  const categories = await db
    .select({
      id: resourceCategories.id,
      name: resourceCategories.name,
      slug: resourceCategories.slug,
      description: resourceCategories.description,
      templateId: resourceCategories.templateId,
      templateName: resourceTemplates.name,
      templateKey: resourceTemplates.key,
      allowLocal: resourceCategories.allowLocal,
      allowExternal: resourceCategories.allowExternal,
      allowCommercialExternal: resourceCategories.allowCommercialExternal,
      allowFileless: resourceCategories.allowFileless,
      alwaysModerateCreate: resourceCategories.alwaysModerateCreate,
      alwaysModerateUpdate: resourceCategories.alwaysModerateUpdate,
      enableVersioning: resourceCategories.enableVersioning,
      enableSupportUrl: resourceCategories.enableSupportUrl,
      requirePrefix: resourceCategories.requirePrefix,
      minTags: resourceCategories.minTags,
      parentCategoryId: resourceCategories.parentCategoryId,
      displayOrder: resourceCategories.displayOrder,
      resourcesCount: resourceCategories.resourceCount
    })
    .from(resourceCategories)
    .leftJoin(resourceTemplates, eq(resourceCategories.templateId, resourceTemplates.id))
    .orderBy(resourceCategories.id)

  return {
    templates,
    categories: categories.map((c) => ({
      ...c,
      resourcesCount: Number(c.resourcesCount ?? 0)
    }))
  }
})

