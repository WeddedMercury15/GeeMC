import { count, desc, eq, inArray } from 'drizzle-orm'
import { groupMembers, userGroups, users } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { requireGeemcAdmin } from '../../../utils/requireGeemcAdmin'

export default defineEventHandler(async (event) => {
  await requireGeemcAdmin(event)

  const q = getQuery(event)
  const page = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(q.pageSize) || 20))
  const offset = (page - 1) * pageSize

  const db = await useDb()

  const [totalRow] = await db.select({ value: count() }).from(users)
  const total = totalRow?.value ?? 0

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      createdAt: users.createdAt,
      geeIdUserId: users.geeIdUserId
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset(offset)

  const ids = rows.map((r) => r.id)
  const groupByUser = new Map<number, string[]>()

  if (ids.length > 0) {
    const memberRows = await db
      .select({
        userId: groupMembers.userId,
        name: userGroups.name
      })
      .from(groupMembers)
      .innerJoin(userGroups, eq(groupMembers.groupId, userGroups.id))
      .where(inArray(groupMembers.userId, ids))

    for (const m of memberRows) {
      const uid = Number(m.userId)
      const list = groupByUser.get(uid) ?? []
      list.push(String(m.name))
      groupByUser.set(uid, list)
    }
  }

  const items = rows.map((r) => ({
    id: r.id,
    username: r.username,
    createdAt: r.createdAt,
    geeLinked: r.geeIdUserId != null && r.geeIdUserId !== '',
    groups: (groupByUser.get(r.id) ?? []).sort((a, b) => a.localeCompare(b))
  }))

  return { items, total, page, pageSize }
})
