import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { categoryFields, resourceFields } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { requireGeemcAdmin } from '../../../utils/requireGeemcAdmin'

const fieldSchema = z.object({
  id: z.string().min(1).max(25),
  title: z.string().min(1).max(255),
  description: z.string().max(1024).optional(),
  displayGroup: z.string().min(1).max(25),
  displayOrder: z.number().int().min(0),
  fieldType: z.string().min(1).max(25),
  fieldChoices: z.record(z.string(), z.string()).optional(),
  required: z.boolean(),
  maxLength: z.number().int().min(0),
  viewableResource: z.boolean(),
  categoryIds: z.array(z.number().int().positive())
})

const payloadSchema = z.discriminatedUnion('intent', [
  z.object({ intent: z.literal('create'), data: fieldSchema }),
  z.object({ intent: z.literal('update'), fieldId: z.string().min(1), data: fieldSchema }),
  z.object({ intent: z.literal('delete'), fieldId: z.string().min(1) })
])

export default defineEventHandler(async (event) => {
  await requireGeemcAdmin(event)
  const db = await useDb()
  const body = await readBody(event)
  const parsed = payloadSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid input' })
  }

  const p = parsed.data

  if (p.intent === 'delete') {
    await db.delete(resourceFields).where(eq(resourceFields.id, p.fieldId))
    return { success: true, message: 'deleteSuccess' }
  }

  if (p.intent === 'create') {
    const existed = await db.select({ id: resourceFields.id }).from(resourceFields).where(eq(resourceFields.id, p.data.id)).limit(1)
    if (existed.length > 0) return { success: false, error: 'FieldExists' }

    await db.insert(resourceFields).values({
      id: p.data.id,
      title: p.data.title,
      description: p.data.description ?? '',
      displayGroup: p.data.displayGroup,
      displayOrder: p.data.displayOrder,
      fieldType: p.data.fieldType,
      fieldChoices: p.data.fieldChoices ?? {},
      required: p.data.required,
      maxLength: p.data.maxLength,
      viewableResource: p.data.viewableResource
    })

    if (p.data.categoryIds.length > 0) {
      await db.insert(categoryFields).values(
        p.data.categoryIds.map((categoryId) => ({
          categoryId,
          fieldId: p.data.id
        }))
      )
    }
    return { success: true, message: 'createSuccess' }
  }

  if (p.data.id !== p.fieldId) {
    return { success: false, error: 'FieldIdImmutable' }
  }

  await db
    .update(resourceFields)
    .set({
      title: p.data.title,
      description: p.data.description ?? '',
      displayGroup: p.data.displayGroup,
      displayOrder: p.data.displayOrder,
      fieldType: p.data.fieldType,
      fieldChoices: p.data.fieldChoices ?? {},
      required: p.data.required,
      maxLength: p.data.maxLength,
      viewableResource: p.data.viewableResource
    })
    .where(eq(resourceFields.id, p.fieldId))

  await db.delete(categoryFields).where(eq(categoryFields.fieldId, p.fieldId))
  if (p.data.categoryIds.length > 0) {
    await db.insert(categoryFields).values(
      p.data.categoryIds.map((categoryId) => ({
        categoryId,
        fieldId: p.data.id
      }))
    )
  }

  return { success: true, message: 'updateSuccess' }
})
