import { eq, sql, asc } from 'drizzle-orm'
import { groupMembers, userGroups } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { requireGeemcAdmin } from '../../../utils/requireGeemcAdmin'
import { resolveUserGroupClaims } from '../../../utils/userGroupClaims'
import { ALL_PERMISSION_KEYS } from '../../../constants/geemc-groups'

export default defineEventHandler(async (event) => {
  const operator = await requireGeemcAdmin(event)
  const db = await useDb()

  const groupsList = await db
    .select({
      id: userGroups.id,
      name: userGroups.name,
      slug: userGroups.slug,
      description: userGroups.description,
      isSystemDefault: userGroups.isSystemDefault,
      permissions: userGroups.permissions,
      memberCount: sql<number>`count(${groupMembers.userId})`
    })
    .from(userGroups)
    .leftJoin(groupMembers, eq(groupMembers.groupId, userGroups.id))
    .groupBy(userGroups.id)
    .orderBy(asc(userGroups.id))

  const claims = await resolveUserGroupClaims(db, Number(operator.id))
  const operatorIsSuperAdmin = claims.groupSlugs.includes('super_admin')
  const operatorPermissions = operatorIsSuperAdmin ? [...ALL_PERMISSION_KEYS] : claims.permissions

  return {
    groups: groupsList.map(g => ({
      ...g,
      memberCount: Number((g as { memberCount: unknown }).memberCount ?? 0)
    })),
    allPermissionKeys: ALL_PERMISSION_KEYS,
    operatorPermissions
  }
})
