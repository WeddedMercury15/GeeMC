import { and, desc, eq, gte } from 'drizzle-orm'
import { z } from 'zod'
import { resourceModerationLogs } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { requireGeemcAdmin } from '../../../utils/requireGeemcAdmin'
import { changeResourceState } from '../../../utils/resourceStateService'
import { resolveUserGroupClaims } from '../../../utils/userGroupClaims'

const payloadSchema = z.object({
  logId: z.number().int().positive(),
  reason: z.string().max(1000).optional()
})
const ROLLBACK_COOLDOWN_MS = 60 * 1000

export default defineEventHandler(async (event) => {
  const adminUser = await requireGeemcAdmin(event)
  const parsed = payloadSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  }

  const db = await useDb()
  const claims = await resolveUserGroupClaims(db, Number(adminUser.id))
  if (!claims.groupSlugs.includes('super_admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Rollback requires super_admin' })
  }
  const [logRow] = await db
    .select({
      id: resourceModerationLogs.id,
      resourceId: resourceModerationLogs.resourceId,
      action: resourceModerationLogs.action,
      fromState: resourceModerationLogs.fromState,
      toState: resourceModerationLogs.toState
    })
    .from(resourceModerationLogs)
    .where(eq(resourceModerationLogs.id, parsed.data.logId))
    .limit(1)

  if (!logRow) {
    throw createError({ statusCode: 404, statusMessage: 'Log not found' })
  }
  if (!['hide', 'restore', 'delete', 'rollback'].includes(logRow.action)) {
    throw createError({ statusCode: 400, statusMessage: 'This log action cannot be rolled back' })
  }

  const cooldownFrom = new Date(Date.now() - ROLLBACK_COOLDOWN_MS).toISOString()
  const [lastRollback] = await db
    .select({
      id: resourceModerationLogs.id,
      createdAt: resourceModerationLogs.createdAt
    })
    .from(resourceModerationLogs)
    .where(
      and(
        eq(resourceModerationLogs.resourceId, logRow.resourceId),
        eq(resourceModerationLogs.action, 'rollback'),
        gte(resourceModerationLogs.createdAt, cooldownFrom)
      )
    )
    .orderBy(desc(resourceModerationLogs.createdAt), desc(resourceModerationLogs.id))
    .limit(1)
  if (lastRollback) {
    throw createError({ statusCode: 429, statusMessage: 'Rollback is rate-limited, try again later' })
  }

  const reason = parsed.data.reason || `Rollback log #${logRow.id}`
  const result = await changeResourceState({
    db,
    resourceId: logRow.resourceId,
    actorUserId: Number(adminUser.id),
    action: 'rollback',
    source: 'admin_rollback',
    nextState: logRow.fromState,
    reason
  })

  return { success: true, changed: result.changed }
})

