import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as schema from './schema'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'

const type = process.env.DB_TYPE || 'sqlite'

function resolveUrl(): string {
  const fromEnv = process.env.DATABASE_URL
  if (fromEnv) {
    return fromEnv
  }
  if (type === 'mysql') {
    throw new Error('DATABASE_URL is required when DB_TYPE=mysql')
  }
  const filePath = join(process.cwd(), 'storage', 'database', 'geemc.db')
  mkdirSync(dirname(filePath), { recursive: true })
  return pathToFileURL(filePath).href
}

const url = resolveUrl()

const MYSQL_POOL_KEY = '__geemcMysqlPool'
const MYSQL_DB_KEY = '__geemcMysqlDb'
const SQLITE_CLIENT_KEY = '__geemcSqliteClient'
const SQLITE_DB_KEY = '__geemcSqliteDb'

let client: unknown
let db: LibSQLDatabase<typeof schema> | undefined

export function getDb(): LibSQLDatabase<typeof schema> {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

let mysqlReconnectPromise: Promise<void> | null = null

function isRecoverableMysqlConnectionError(error: unknown) {
  const code = String((error as { code?: string })?.code || '')
  const recoverableCodes = [
    'PROTOCOL_CONNECTION_LOST',
    'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
    'PROTOCOL_ENQUEUE_AFTER_QUIT',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EPIPE'
  ]

  if (recoverableCodes.includes(code)) {
    return true
  }

  const message = String((error as { message?: string })?.message || '')
  return /ECONNRESET|ECONNREFUSED|ETIMEDOUT|PROTOCOL_CONNECTION_LOST|socket hang up|connection.*closed|pool is closed/i.test(message)
}

async function createMysqlPoolAndDb() {
  const { drizzle: drizzleMysql } = await import('drizzle-orm/mysql2')
  const mysqlImport = await import('mysql2/promise')
  const mysql = mysqlImport.default || mysqlImport

  const parsed = new URL(url)
  const pool = mysql.createPool({
    uri: url,
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username || ''),
    password: decodeURIComponent(parsed.password || ''),
    database: parsed.pathname.replace(/^\//, ''),
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 10_000
  })

  return {
    pool,
    drizzleDb: drizzleMysql({ client: pool, schema, mode: 'default' })
  }
}

async function initDb() {
  if (db && client) {
    return
  }

  if (type === 'mysql') {
    const globalState = globalThis as Record<string, unknown>
    if (globalState[MYSQL_POOL_KEY] && globalState[MYSQL_DB_KEY]) {
      client = globalState[MYSQL_POOL_KEY]
      db = globalState[MYSQL_DB_KEY] as LibSQLDatabase<typeof schema>
      return
    }

    const { pool, drizzleDb } = await createMysqlPoolAndDb()

    client = pool
    db = drizzleDb as unknown as LibSQLDatabase<typeof schema>

    globalState[MYSQL_POOL_KEY] = client
    globalState[MYSQL_DB_KEY] = db
    return
  }

  const globalState = globalThis as Record<string, unknown>
  if (globalState[SQLITE_CLIENT_KEY] && globalState[SQLITE_DB_KEY]) {
    client = globalState[SQLITE_CLIENT_KEY]
    db = globalState[SQLITE_DB_KEY] as LibSQLDatabase<typeof schema>
    return
  }

  const { createClient } = await import('@libsql/client')
  const { drizzle: drizzleLibsql } = await import('drizzle-orm/libsql')

  const sqliteClient = createClient({
    url,
    syncUrl: undefined,
    syncInterval: undefined
  })

  client = sqliteClient
  db = drizzleLibsql({ client: sqliteClient, schema })

  globalState[SQLITE_CLIENT_KEY] = client
  globalState[SQLITE_DB_KEY] = db
}

export async function ensureDbConnection() {
  await initDb()

  if (type !== 'mysql') {
    return
  }

  const queryOne = () => (client as { query: (sql: string) => Promise<unknown> }).query('SELECT 1')

  try {
    await queryOne()
  } catch (error: unknown) {
    if (!isRecoverableMysqlConnectionError(error)) {
      throw error
    }

    if (!mysqlReconnectPromise) {
      mysqlReconnectPromise = (async () => {
        const globalState = globalThis as Record<string, unknown>

        try {
          if (globalState[MYSQL_POOL_KEY]) {
            await (globalState[MYSQL_POOL_KEY] as { end: () => Promise<void> }).end()
          }
        } catch {
          // ignore
        }

        const { pool: nextPool, drizzleDb } = await createMysqlPoolAndDb()

        client = nextPool
        db = drizzleDb as unknown as LibSQLDatabase<typeof schema>

        globalState[MYSQL_POOL_KEY] = client
        globalState[MYSQL_DB_KEY] = db
      })().finally(() => {
        mysqlReconnectPromise = null
      })
    }

    await mysqlReconnectPromise
    await queryOne()
  }
}

export { initDb }
