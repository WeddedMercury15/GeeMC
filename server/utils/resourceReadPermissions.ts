import { eq } from 'drizzle-orm'
import { resources } from '../database/schema'
import { getCurrentUser } from './auth'
import { canManageResourceByTeam } from './resourceTeam'
import { resolveUserGroupClaims } from './userGroupClaims'

type DbLike = Awaited<ReturnType<typeof import('./db').useDb>>

export async function assertCanReadResource(params: {
  db: DbLike
  event: Parameters<typeof getCurrentUser>[0]
  resourceId: string
}) {
  const { db, event, resourceId } = params
  const [resRow] = await db
    .select({
      id: resources.id,
      resourceState: resources.resourceState,
      authorUserId: resources.authorUserId,
      teamMemberUserIds: resources.teamMemberUserIds
    })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)

  if (!resRow) throw createError({ statusCode: 404, statusMessage: 'Resource not found' })

  if (resRow.resourceState === 'visible') return resRow

  const currentUser = await getCurrentUser(event)
  if (!currentUser) throw createError({ statusCode: 404, statusMessage: 'Resource not found' })

  const perms = (await resolveUserGroupClaims(db, currentUser.id)).permissions
  const canViewNonVisible =
    perms.includes('geemc.publish') &&
    canManageResourceByTeam({
      authorUserId: resRow.authorUserId,
      teamMemberUserIds: resRow.teamMemberUserIds,
      userId: currentUser.id
    })

  if (!canViewNonVisible) throw createError({ statusCode: 404, statusMessage: 'Resource not found' })
  return resRow
}

