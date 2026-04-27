import { count } from 'drizzle-orm'
import type { Db } from './db'
import { resourceTemplates } from '../database/schema'

export async function ensureDefaultResourceTemplates(db: Db) {
  const [row] = await db.select({ c: count() }).from(resourceTemplates)
  const current = Number(row?.c ?? 0)
  if (current > 0) return

  await db.insert(resourceTemplates).values([
    { name: 'Default', key: 'default', cardAspectRatio: '16/9' },
    { name: 'Grid', key: 'grid', cardAspectRatio: '1/1' }
  ])
}
