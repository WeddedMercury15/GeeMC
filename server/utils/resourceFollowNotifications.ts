import { and, eq } from 'drizzle-orm'
import { resourceFollows, userNotifications } from '../database/schema'

type DbLike = {
  select: any
  insert: any
  update: any
}

export type NotificationTarget =
  | { tab: 'versions', anchor?: string }
  | { tab: 'changelog', anchor?: string }
  | { tab: 'description' }
  | { tab: 'reviews', anchor?: string }

export function encodeNotificationMessage(params: { text: string, target?: NotificationTarget }) {
  const payload = {
    v: 1,
    text: params.text,
    target: params.target
  }
  return JSON.stringify(payload)
}

export async function notifyResourceFollowers(params: {
  db: DbLike
  actorUserId: number
  resourceId: string
  title: string
  message: string
  type: 'resource_update' | 'resource_version' | 'resource_description'
}) {
  const { db, actorUserId, resourceId, title, message, type } = params
  const followerRows = await db
    .select({
      userId: resourceFollows.userId
    })
    .from(resourceFollows)
    .where(eq(resourceFollows.resourceId, resourceId))

  const now = new Date().toISOString()
  const values = followerRows
    .map((r: { userId: number }) => Number(r.userId))
    .filter((uid: number) => Number.isFinite(uid) && uid > 0 && uid !== Number(actorUserId))
    .map((userId: number) => ({
      userId,
      type,
      title,
      message,
      resourceId,
      readAt: '',
      createdAt: now
    }))

  if (values.length > 0) {
    await db.insert(userNotifications).values(values)
  }
}

export async function markNotificationRead(params: { db: DbLike, userId: number, id: number }) {
  const { db, userId, id } = params
  const [row] = await db
    .select({
      id: userNotifications.id
    })
    .from(userNotifications)
    .where(and(eq(userNotifications.id, id), eq(userNotifications.userId, userId)))
    .limit(1)
  if (!row) return false

  const now = new Date().toISOString()
  await db
    .update(userNotifications)
    .set({ readAt: now })
    .where(eq(userNotifications.id, id))
  return true
}

