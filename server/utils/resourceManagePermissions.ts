import { eq } from 'drizzle-orm'
import { resources } from '../database/schema'
import { canManageResourceByTeam } from './resourceTeam'

type DbLike = Awaited<ReturnType<typeof import('./db').useDb>>

export async function assertCanManageResource(params: {
  db: DbLike
  resourceId: string
  userId: number
  allowDeleted?: boolean
}) {
  const { db, resourceId, userId, allowDeleted = false } = params
  const [row] = await db
    .select({
      id: resources.id,
      resourceState: resources.resourceState,
      authorUserId: resources.authorUserId,
      teamMemberUserIds: resources.teamMemberUserIds
    })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Resource not found' })

  if (!canManageResourceByTeam({
    authorUserId: row.authorUserId,
    teamMemberUserIds: row.teamMemberUserIds,
    userId
  })) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (!allowDeleted && row.resourceState === 'deleted') {
    throw createError({ statusCode: 403, statusMessage: 'Cannot modify a deleted resource' })
  }
}

