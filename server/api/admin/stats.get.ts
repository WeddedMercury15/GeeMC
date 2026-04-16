import os from 'node:os'
import { count, gt, sql } from 'drizzle-orm'
import { sessions, userGroups, users } from '../../database/schema'
import { useDb } from '../../utils/db'
import { requireGeemcAdmin } from '../../utils/requireGeemcAdmin'

export default defineEventHandler(async (event) => {
  await requireGeemcAdmin(event)

  const db = await useDb()

  const [userCount] = await db.select({ value: count() }).from(users)

  const firstDayOfMonth = new Date()
  firstDayOfMonth.setDate(1)
  firstDayOfMonth.setHours(0, 0, 0, 0)

  const [newUsersThisMonth] = await db
    .select({ value: count() })
    .from(users)
    .where(sql`${users.createdAt} >= ${firstDayOfMonth.toISOString()}`)

  const [groupsCount] = await db.select({ value: count() }).from(userGroups)

  const nowIso = new Date().toISOString()
  const [activeSessionsCount] = await db
    .select({ value: count() })
    .from(sessions)
    .where(gt(sessions.expiresAt, nowIso))

  const load = os.loadavg()
  const loadStatus = (load[0] ?? 0) > 2 ? 'High' : 'Normal'

  const dbType = process.env.DB_TYPE || 'sqlite'
  const dbUrl = process.env.DATABASE_URL || 'file:storage/local.db'

  let dbName = 'SQLite'
  if (dbType === 'mysql') {
    dbName = 'MySQL'
  } else if (dbUrl.includes('turso')) {
    dbName = 'Turso'
  }

  const nodeEnv = process.env.NODE_ENV || 'development'

  return {
    stats: {
      totalUsers: {
        value: userCount?.value ?? 0,
        newThisMonth: newUsersThisMonth?.value ?? 0
      },
      userGroups: {
        value: groupsCount?.value ?? 0
      },
      activeSessions: {
        value: activeSessionsCount?.value ?? 0
      },
      system: {
        status: loadStatus,
        load,
        orm: 'Drizzle ORM',
        database: dbName,
        environment: nodeEnv
      }
    }
  }
})
