import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { resources, users } from '../../../../database/schema'
import { useDb } from '../../../../utils/db'
import { requireGeemcPublish } from '../../../../utils/requireGeemcPublish'
import { normalizeTeamMemberIds } from '../../../../utils/resourceTeam'
import { resolveUserGroupClaims } from '../../../../utils/userGroupClaims'

const payloadSchema = z.object({
  usernames: z.array(z.string().min(1).max(255)).max(20).default([])
})

export default defineEventHandler(async (event) => {
  const user = await requireGeemcPublish(event)
  const resourceId = getRouterParam(event, 'id')
  if (!resourceId) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const parsed = payloadSchema.safeParse(await readBody(event))
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
      authorUserId: resources.authorUserId,
      teamMemberUserIds: resources.teamMemberUserIds
    })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)
  if (!resourceRow) throw createError({ statusCode: 404, statusMessage: 'Resource not found' })

  const claims = await resolveUserGroupClaims(db, Number(user.id))
  const isAdmin = claims.permissions.includes('geemc.admin')
  if (Number(resourceRow.authorUserId) !== Number(user.id) && !isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Only author or admin can manage team members' })
  }

  const normalizedNames = Array.from(
    new Set(
      parsed.data.usernames
        .map(name => name.trim())
        .filter(Boolean)
    )
  )

  let memberIds: number[] = []
  if (normalizedNames.length > 0) {
    const rows = await db
      .select({
        id: users.id,
        username: users.username
      })
      .from(users)
      .where(inArray(users.username, normalizedNames))
    memberIds = normalizeTeamMemberIds(rows.map(r => r.id))
  }

  memberIds = memberIds.filter(id => id !== Number(resourceRow.authorUserId))

  await db
    .update(resources)
    .set({ teamMemberUserIds: memberIds })
    .where(eq(resources.id, resourceId))

  return { success: true, teamMemberUserIds: memberIds }
})
