import { asc, eq } from 'drizzle-orm'
import { categoryFields, resourceCategories, resourceFields } from '../../database/schema'
import { useDb } from '../../utils/db'
import { requireGeemcPublish } from '../../utils/requireGeemcPublish'

export default defineEventHandler(async (event) => {
  await requireGeemcPublish(event)
  const db = await useDb()

  const categories = await db
    .select({
      id: resourceCategories.id,
      name: resourceCategories.name,
      slug: resourceCategories.slug,
      allowLocal: resourceCategories.allowLocal,
      allowExternal: resourceCategories.allowExternal,
      allowCommercialExternal: resourceCategories.allowCommercialExternal,
      allowFileless: resourceCategories.allowFileless,
      enableVersioning: resourceCategories.enableVersioning
    })
    .from(resourceCategories)
    .orderBy(asc(resourceCategories.displayOrder), asc(resourceCategories.id))

  const fields = await db
    .select({
      id: resourceFields.id,
      title: resourceFields.title,
      description: resourceFields.description,
      displayGroup: resourceFields.displayGroup,
      displayOrder: resourceFields.displayOrder,
      fieldType: resourceFields.fieldType,
      fieldChoices: resourceFields.fieldChoices,
      required: resourceFields.required,
      maxLength: resourceFields.maxLength
    })
    .from(resourceFields)
    .orderBy(asc(resourceFields.displayGroup), asc(resourceFields.displayOrder), asc(resourceFields.id))

  const links = await db.select().from(categoryFields)
  const fieldCategoryMap = new Map<string, number[]>()
  for (const link of links) {
    const list = fieldCategoryMap.get(link.fieldId) ?? []
    list.push(link.categoryId)
    fieldCategoryMap.set(link.fieldId, list)
  }

  return {
    categories,
    fields: fields.map(f => ({
      ...f,
      categoryIds: fieldCategoryMap.get(f.id) ?? []
    }))
  }
})
