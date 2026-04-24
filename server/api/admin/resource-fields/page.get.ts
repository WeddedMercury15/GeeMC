import { asc, eq } from 'drizzle-orm'
import { categoryFields, resourceCategories, resourceFields } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { requireGeemcAdmin } from '../../../utils/requireGeemcAdmin'

export default defineEventHandler(async (event) => {
  await requireGeemcAdmin(event)
  const db = await useDb()

  const categories = await db
    .select({
      id: resourceCategories.id,
      name: resourceCategories.name
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
      maxLength: resourceFields.maxLength,
      viewableResource: resourceFields.viewableResource
    })
    .from(resourceFields)
    .orderBy(asc(resourceFields.displayGroup), asc(resourceFields.displayOrder), asc(resourceFields.id))

  const links = await db.select().from(categoryFields)
  const byField = new Map<string, number[]>()
  for (const link of links) {
    const list = byField.get(link.fieldId) ?? []
    list.push(link.categoryId)
    byField.set(link.fieldId, list)
  }

  return {
    categories,
    fields: fields.map((f) => ({
      ...f,
      categoryIds: byField.get(f.id) ?? []
    }))
  }
})
