import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { categoryFields, resourceCategories, resourceUpdates, resourceVersionFieldValues, resourceFields, resourceVersions, resources } from '../../../../database/schema'
import { useDb } from '../../../../utils/db'
import { requireGeemcPublish } from '../../../../utils/requireGeemcPublish'
import { normalizeResourceFieldChoices } from '../../../../utils/resourceFieldChoices'
import { recalcAndUpdateCategoryLastResource } from '../../../../utils/resourceCategoryStats'
import { encodeNotificationMessage, notifyResourceFollowers } from '../../../../utils/resourceFollowNotifications'
import { canManageResourceByTeam } from '../../../../utils/resourceTeam'

const payloadSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['release', 'beta', 'alpha']).default('release'),
  size: z.string().min(1).max(64).default('0 MB'),
  gameVersions: z.array(z.string()).default([]),
  loaders: z.array(z.string()).default([]),
  serverTypes: z.array(z.string()).default([]),
  versionCustomFields: z.record(z.string(), z.string()).default({}),
  updateMessage: z.string().min(1)
})

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
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
        return new RegExp(pattern).test(value)
      } catch {
        return true
      }
    }
    default:
      return true
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireGeemcPublish(event)
  const resourceId = getRouterParam(event, 'id')
  if (!resourceId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

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

  const db = await useDb()
  const [resourceRow] = await db
    .select({
      id: resources.id,
      title: resources.title,
      categoryKey: resources.categoryKey,
      authorUserId: resources.authorUserId,
      teamMemberUserIds: resources.teamMemberUserIds,
      updateCount: resources.updateCount
    })
    .from(resources)
    .leftJoin(resourceCategories, eq(resources.categoryKey, resourceCategories.slug))
    .where(eq(resources.id, resourceId))
    .limit(1)

  if (!resourceRow) {
    throw createError({ statusCode: 404, statusMessage: 'Resource not found' })
  }

  if (!canManageResourceByTeam({
    authorUserId: resourceRow.authorUserId,
    teamMemberUserIds: resourceRow.teamMemberUserIds,
    userId: user.id
  })) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const now = new Date().toISOString()
  const p = parsed.data

  await db.insert(resourceVersions).values({
    resourceId,
    name: p.name,
    type: p.type,
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

  const [categoryRow] = await db
    .select({ id: resourceCategories.id })
    .from(resourceCategories)
    .where(eq(resourceCategories.slug, resourceRow.categoryKey))
    .limit(1)

  const links = categoryRow
    ? await db.select().from(categoryFields).where(eq(categoryFields.categoryId, categoryRow.id))
    : []
  const fieldIds = links.map(link => link.fieldId)
  if (latestVersion && fieldIds.length > 0) {
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
    const versionDefs = defs.filter(def => fieldIds.includes(def.id) && (def.fieldScope ?? 'resource') === 'version')
    for (const def of versionDefs) {
      const value = String(p.versionCustomFields[def.id] ?? '').trim()
      if (def.required && !value) {
        throw createError({ statusCode: 400, statusMessage: `Required field missing: ${def.id}` })
      }
      if (!value) continue
      const choices = Object.keys(normalizeResourceFieldChoices(def.fieldChoices))
      if ((def.fieldType === 'select' || def.fieldType === 'radio') && choices.length > 0 && !choices.includes(value)) {
        throw createError({ statusCode: 400, statusMessage: `Invalid field choice: ${def.id}` })
      }
      if ((def.fieldType === 'checkbox' || def.fieldType === 'multiselect') && choices.length > 0) {
        const selected = value.split(',').map(item => item.trim()).filter(Boolean)
        if (selected.some(item => !choices.includes(item))) {
          throw createError({ statusCode: 400, statusMessage: `Invalid field choice: ${def.id}` })
        }
      }
      if (Number(def.maxLength || 0) > 0 && value.length > Number(def.maxLength)) {
        throw createError({ statusCode: 400, statusMessage: `Field too long: ${def.id}` })
      }
      if (!validateFieldByMatchType(value, def.matchType, def.matchParams || {})) {
        throw createError({ statusCode: 400, statusMessage: `Invalid field format: ${def.id}` })
      }
      await db.insert(resourceVersionFieldValues).values({
        resourceVersionId: latestVersion.id,
        fieldId: def.id,
        fieldValue: value
      })
    }
  }

  await db.insert(resourceUpdates).values({
    resourceId,
    resourceVersionId: latestVersion?.id ?? null,
    title: '',
    message: p.updateMessage,
    messageHtml: p.updateMessage,
    postDate: now,
    updateType: p.type,
    isDescription: false,
    versionString: p.name,
    messageState: 'visible'
  })

  await db
    .update(resources)
    .set({
      currentVersionId: latestVersion?.id ?? 0,
      updateCount: (resourceRow.updateCount ?? 0) + 1,
      lastUpdate: now,
      updateDate: now
    })
    .where(eq(resources.id, resourceId))

  await recalcAndUpdateCategoryLastResource(db, resourceRow.categoryKey)
  await notifyResourceFollowers({
    db,
    actorUserId: Number(user.id),
    resourceId,
    type: 'resource_version',
    title: resourceRow.title,
    message: encodeNotificationMessage({
      text: `New version published: ${p.name}`,
      target: latestVersion?.id ? { tab: 'versions', anchor: `version-${latestVersion.id}` } : { tab: 'versions' }
    })
  })

  return { success: true }
})
