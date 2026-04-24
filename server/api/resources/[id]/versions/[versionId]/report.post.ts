import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { groupMembers, resourceVersions, resources, userGroups, userNotifications } from '../../../../../../database/schema'
import { getCurrentUser } from '../../../../../../utils/auth'
import { useDb } from '../../../../../../utils/db'
import { canManageResourceByTeam } from '../../../../../../utils/resourceTeam'

const payloadSchema = z.object({
  reason: z.string().trim().min(1).max(500)
})

export default defineEventHandler(async (event) => {
  const reporter = await getCurrentUser(event)
  if (!reporter) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const resourceId = getRouterParam(event, 'id')
  const versionId = Number(getRouterParam(event, 'versionId'))
  if (!resourceId || !Number.isFinite(versionId) || versionId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid params' })
  }

  const parsed = payloadSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  }

  const db = await useDb()
  const [versionRow] = await db
    .select({
      versionId: resourceVersions.id,
      resourceId: resourceVersions.resourceId,
      resourceTitle: resources.title,
      versionName: resourceVersions.name,
      authorUserId: resources.authorUserId,
      teamMemberUserIds: resources.teamMemberUserIds
    })
    .from(resourceVersions)
    .innerJoin(resources, eq(resourceVersions.resourceId, resources.id))
    .where(and(eq(resourceVersions.id, versionId), eq(resourceVersions.resourceId, resourceId)))
    .limit(1)

  if (!versionRow) {
    throw createError({ statusCode: 404, statusMessage: 'Version not found' })
  }
  if (canManageResourceByTeam({
    authorUserId: versionRow.authorUserId,
    teamMemberUserIds: versionRow.teamMemberUserIds,
    userId: reporter.id
  })) {
    throw createError({ statusCode: 400, statusMessage: 'Managers cannot report this version' })
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
    text: `${reporter.username} reported a version (${versionRow.versionName}): ${parsed.data.reason}`,
    target: { tab: 'versions', anchor: `version-${versionRow.versionId}` }
  })
  await db.insert(userNotifications).values(
    adminUserIds.map(adminUserId => ({
      userId: adminUserId,
      type: 'resource_version_report',
      title: `Version report · ${versionRow.resourceTitle}`,
      message,
      resourceId: versionRow.resourceId,
      readAt: '',
      createdAt: now
    }))
  )

  return { success: true }
})
