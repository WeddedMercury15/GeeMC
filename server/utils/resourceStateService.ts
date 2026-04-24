import { eq } from 'drizzle-orm'
import { resourceModerationLogs, resources } from '../database/schema'
import { recalcAndUpdateCategoryLastResource } from './resourceCategoryStats'

type DbLike = {
  select: any
  update: any
  insert: any
}

export type ResourceStateIntent = 'hide' | 'restore' | 'delete'

export function resolveStateByIntent(intent: ResourceStateIntent) {
  if (intent === 'hide') return 'moderated'
  if (intent === 'delete') return 'deleted'
  return 'visible'
}

export async function changeResourceState(params: {
  db: DbLike
  resourceId: string
  actorUserId: number
  action: string
  source: string
  nextState: string
  reason?: string
}) {
  const { db, resourceId, actorUserId, action, source, nextState, reason } = params

  const [resourceRow] = await db
    .select({
      id: resources.id,
      categoryKey: resources.categoryKey,
      resourceState: resources.resourceState
    })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)

  if (!resourceRow) return { changed: false, categoryKey: '' }
  if (resourceRow.resourceState === nextState) return { changed: false, categoryKey: resourceRow.categoryKey }

  const now = new Date().toISOString()
  await db
    .update(resources)
    .set({
      resourceState: nextState,
      lastUpdate: now,
      updateDate: now
    })
    .where(eq(resources.id, resourceId))

  await db.insert(resourceModerationLogs).values({
    resourceId,
    actorUserId,
    action,
    source,
    fromState: resourceRow.resourceState,
    toState: nextState,
    reason: reason ?? '',
    createdAt: now
  })

  await recalcAndUpdateCategoryLastResource(db, resourceRow.categoryKey)
  return { changed: true, categoryKey: resourceRow.categoryKey }
}

