import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { categoryFields, resourceFields } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { requireGeemcAdmin } from '../../../utils/requireGeemcAdmin'
import { normalizeResourceFieldChoices } from '../../../utils/resourceFieldChoices'

const DISPLAY_GROUP_VALUES = ['above_info', 'below_info', 'above_rating', 'below_rating', 'below_sidebar_buttons', 'sidebar', 'extra_tab', 'new_tab'] as const

function normalizeDisplayGroups(groups: string[]) {
  const next = Array.from(new Set(groups.map(group => String(group || '').trim()).filter(Boolean)))
  return next.length > 0 ? next : ['above_info']
}

const choiceSchema = z.object({
  label: z.string().min(1).max(255),
  iconUrl: z.string().max(2048).optional()
})

const fieldSchema = z.object({
  id: z.string().min(1).max(25),
  title: z.string().min(1).max(255),
  description: z.string().max(1024).optional(),
  displayGroups: z.array(z.enum(DISPLAY_GROUP_VALUES)).min(1).max(DISPLAY_GROUP_VALUES.length),
  displayOrder: z.number().int().min(0),
  fieldScope: z.enum(['resource', 'version']).default('resource'),
  fieldType: z.enum(['textbox', 'textarea', 'select', 'radio', 'checkbox', 'multiselect']),
  fieldChoices: z.record(z.string(), choiceSchema).optional(),
  matchType: z.enum(['none', 'number', 'alphanumeric', 'email', 'url', 'regex']).default('none'),
  matchParams: z.record(z.string(), z.string()).optional(),
  required: z.boolean(),
  maxLength: z.number().int().min(0),
  versionFilterable: z.boolean().default(false),
  viewableResource: z.boolean(),
  categoryIds: z.array(z.number().int().positive())
}).superRefine((value, ctx) => {
  if (!value.versionFilterable) return
  if (value.fieldScope !== 'version') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['versionFilterable'],
      message: 'Only version fields can be used as version filters'
    })
  }
  if (!['select', 'radio', 'checkbox', 'multiselect'].includes(value.fieldType)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fieldType'],
      message: 'Only selectable fields can be used as version filters'
    })
  }
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
    const details = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message
    }))
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid input',
      data: {
        code: 'VALIDATION_ERROR',
        details
      }
    })
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
      displayGroup: normalizeDisplayGroups(p.data.displayGroups).join(','),
      displayOrder: p.data.displayOrder,
      fieldScope: p.data.fieldScope,
      fieldType: p.data.fieldType,
      fieldChoices: normalizeResourceFieldChoices(p.data.fieldChoices ?? {}),
      matchType: p.data.matchType,
      matchParams: p.data.matchParams ?? {},
      required: p.data.required,
      maxLength: p.data.maxLength,
      versionFilterable: p.data.versionFilterable,
      viewableResource: p.data.viewableResource
    })

    if (p.data.categoryIds.length > 0) {
      await db.insert(categoryFields).values(
        p.data.categoryIds.map(categoryId => ({
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
      displayGroup: normalizeDisplayGroups(p.data.displayGroups).join(','),
      displayOrder: p.data.displayOrder,
      fieldScope: p.data.fieldScope,
      fieldType: p.data.fieldType,
      fieldChoices: normalizeResourceFieldChoices(p.data.fieldChoices ?? {}),
      matchType: p.data.matchType,
      matchParams: p.data.matchParams ?? {},
      required: p.data.required,
      maxLength: p.data.maxLength,
      versionFilterable: p.data.versionFilterable,
      viewableResource: p.data.viewableResource
    })
    .where(eq(resourceFields.id, p.fieldId))

  await db.delete(categoryFields).where(eq(categoryFields.fieldId, p.fieldId))
  if (p.data.categoryIds.length > 0) {
    await db.insert(categoryFields).values(
      p.data.categoryIds.map(categoryId => ({
        categoryId,
        fieldId: p.data.id
      }))
    )
  }

  return { success: true, message: 'updateSuccess' }
})
