import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { groupMembers, resourceUpdates, resources, userGroups, userNotifications } from '../../../../../database/schema'
import { getCurrentUser } from '../../../../../utils/auth'
import { useDb } from '../../../../../utils/db'
import { canManageResourceByTeam } from '../../../../../utils/resourceTeam'

const payloadSchema = z.object({
  reason: z.string().trim().min(1).max(500)
})

export default defineEventHandler(async (event) => {
  const reporter = await getCurrentUser(event)
  if (!reporter) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const resourceId = getRouterParam(event, 'id')
  const updateId = Number(getRouterParam(event, 'updateId'))
  if (!resourceId || !Number.isFinite(updateId) || updateId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid params' })
  }
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
  const [updateRow] = await db
    .select({
      updateId: resourceUpdates.id,
      messageState: resourceUpdates.messageState,
      resourceId: resourceUpdates.resourceId,
      resourceTitle: resources.title,
      resourceCategoryKey: resources.categoryKey,
      authorUserId: resources.authorUserId,
      teamMemberUserIds: resources.teamMemberUserIds
    })
    .from(resourceUpdates)
    .innerJoin(resources, eq(resourceUpdates.resourceId, resources.id))
    .where(and(eq(resourceUpdates.id, updateId), eq(resourceUpdates.resourceId, resourceId)))
    .limit(1)
  if (!updateRow || updateRow.messageState !== 'visible') {
    throw createError({ statusCode: 404, statusMessage: 'Update not found' })
  }
  if (canManageResourceByTeam({
    authorUserId: updateRow.authorUserId,
    teamMemberUserIds: updateRow.teamMemberUserIds,
    userId: reporter.id
  })) {
    throw createError({ statusCode: 400, statusMessage: 'Managers cannot report this update' })
  }

  const adminGroups = await db
    .select({ id: userGroups.id })
    .from(userGroups)
    .where(inArray(userGroups.slug as never, ['super_admin', 'administrator']))
  const adminGroupIds = adminGroups.map(g => Number(g.id)).filter(v => Number.isFinite(v) && v > 0)
  if (adminGroupIds.length === 0) return { success: true }

  const members = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(inArray(groupMembers.groupId as never, adminGroupIds))
  const adminUserIds = Array.from(new Set(members.map(m => Number(m.userId)).filter(v => Number.isFinite(v) && v > 0)))
  if (adminUserIds.length === 0) return { success: true }

  const now = new Date().toISOString()
  const message = JSON.stringify({
    text: `${reporter.username} reported an update: ${parsed.data.reason}`,
    target: { tab: 'changelog', anchor: `update-${updateRow.updateId}` }
  })
  await db.insert(userNotifications).values(
    adminUserIds.map(adminUserId => ({
      userId: adminUserId,
      type: 'resource_update_report',
      title: `Update report · ${updateRow.resourceTitle}`,
      message,
      resourceId: updateRow.resourceId,
      readAt: '',
      createdAt: now
    }))
  )

  return { success: true }
})
