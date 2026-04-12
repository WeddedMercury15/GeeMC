import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig } from 'drizzle-kit'

const dbType = (process.env.DB_TYPE || 'sqlite') as 'mysql' | 'sqlite'

function defaultSqliteUrl() {
  const filePath = join(process.cwd(), 'storage', 'database', 'geemc.db')
  mkdirSync(dirname(filePath), { recursive: true })
  return pathToFileURL(filePath).href
}

export default defineConfig({
  schema: './server/database/schema.ts',
  out: `./server/database/migrations/${dbType}`,
  dialect: dbType,
  dbCredentials: {
    url: process.env.DATABASE_URL || defaultSqliteUrl()
  }
})
