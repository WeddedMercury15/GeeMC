import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import type * as schema from '../database/schema'
import { ensureDbConnection, getDb, initDb } from '../database/client'

export type Db = LibSQLDatabase<typeof schema>

export async function useDb(): Promise<Db> {
  await initDb()
  await ensureDbConnection()
  return getDb() as Db
}
