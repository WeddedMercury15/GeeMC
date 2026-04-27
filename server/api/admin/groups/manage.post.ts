import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { userGroups } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { requireGeemcAdmin } from '../../../utils/requireGeemcAdmin'
import { resolveUserGroupClaims } from '../../../utils/userGroupClaims'
import { ALL_PERMISSION_KEYS } from '../../../constants/geemc-groups'

const manageSchema = z.object({
  intent: z.enum(['create', 'update', 'delete']),
  groupId: z.number().optional(),
  data: z
    .object({
      name: z.string().min(1),
      slug: z.string().optional(),
      description: z.string().optional(),
      permissions: z.array(z.string()).optional()
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

function resolveSlug(input: string | undefined, fallbackName: string): string {
  const source = input?.trim() || fallbackName
  const slug = toSlug(source)
  if (!slug) {
    throw createError({ statusCode: 400, message: 'invalidSlug' })
  }
  return slug
}

function sanitizePermissions(perms: string[] | undefined): string[] {
  if (!perms) return []
  const validKeys = new Set<string>(ALL_PERMISSION_KEYS)
  return perms.filter(key => validKeys.has(key))
}

function assertGrantablePermissions(operatorPerms: string[], requestedPerms: string[]) {
  const operatorSet = new Set<string>(operatorPerms)
  for (const perm of requestedPerms) {
    if (!operatorSet.has(perm)) {
      throw createError({
        statusCode: 403,
        message: `Cannot grant permission "${perm}" that you do not possess`
      })
    }
  }
}

export default defineEventHandler(async (event) => {
  const operator = await requireGeemcAdmin(event)
  const db = await useDb()

  const body = await readBody(event)
  const result = manageSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid input',
      data: {
        code: 'VALIDATION_ERROR',
        details: result.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      }
    })
  }

  const { intent, groupId, data: groupData } = result.data

  const claims = await resolveUserGroupClaims(db, Number(operator.id))
  const operatorIsSuperAdmin = claims.groupSlugs.includes('super_admin')
  const operatorPermissions = operatorIsSuperAdmin ? [...ALL_PERMISSION_KEYS] : claims.permissions

  try {
    if (intent === 'create' && groupData) {
      const slug = resolveSlug(groupData.slug, groupData.name)
      const requestedPerms = sanitizePermissions(groupData.permissions)

      if (!operatorIsSuperAdmin) {
        assertGrantablePermissions(operatorPermissions, requestedPerms)
      }

      await db.insert(userGroups).values({
        name: groupData.name,
        slug,
        description: groupData.description,
        isSystemDefault: false,
        permissions: requestedPerms
      })

      const created = await db.select().from(userGroups).where(eq(userGroups.slug, slug)).limit(1)
      return { success: true, message: 'createSuccess', data: created[0] }
    }

    if (intent === 'update' && groupId && groupData) {
      const groupArr = await db.select().from(userGroups).where(eq(userGroups.id, groupId)).limit(1)
      const group = groupArr[0]

      if (!group) {
        return { success: false, error: 'Group not found' }
      }

      const isTargetSuperAdmin = group.slug === 'super_admin'
      if (isTargetSuperAdmin && !operatorIsSuperAdmin) {
        throw createError({ statusCode: 403, message: 'Cannot modify super_admin group' })
      }

      const updateData: {
        name: string
        description?: string
        slug?: string
        permissions?: string[]
      } = {
        name: groupData.name,
        description: groupData.description
      }

      if (!group.isSystemDefault) {
        updateData.slug = resolveSlug(groupData.slug, groupData.name)
      }

      if (groupData.permissions !== undefined && !isTargetSuperAdmin) {
        const requestedPerms = sanitizePermissions(groupData.permissions)
        if (!operatorIsSuperAdmin) {
          assertGrantablePermissions(operatorPermissions, requestedPerms)
        }
        updateData.permissions = requestedPerms
      }

      await db.update(userGroups).set(updateData).where(eq(userGroups.id, groupId))

      const updated = await db.select().from(userGroups).where(eq(userGroups.id, groupId)).limit(1)
      return { success: true, message: 'updateSuccess', data: updated[0] }
    }

    if (intent === 'delete' && groupId) {
      const groupArr = await db.select().from(userGroups).where(eq(userGroups.id, groupId)).limit(1)
      const group = groupArr[0]

      if (!group) {
        return { success: false, error: 'Group not found' }
      }

      if (group.isSystemDefault) {
        return { success: false, error: 'cannotDeleteDefault' }
      }

      if (!operatorIsSuperAdmin) {
        const groupPerms = Array.isArray(group.permissions) ? group.permissions : []
        const operatorSet = new Set<string>(operatorPermissions)
        for (const perm of groupPerms) {
          if (!operatorSet.has(perm)) {
            throw createError({
              statusCode: 403,
              message: `Cannot delete group with permission "${perm}" that you do not possess`
            })
          }
        }
      }

      await db.delete(userGroups).where(eq(userGroups.id, groupId))
      return { success: true, message: 'deleteSuccess' }
    }

    return { success: false, error: 'Invalid intent or missing data' }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    const message = error && typeof error === 'object' && 'message' in error ? (error as { message?: string }).message : undefined
    return { success: false, error: message || 'operationFailed' }
  }
})
