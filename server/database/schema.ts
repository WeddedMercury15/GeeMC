import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'
import { mysqlTable, varchar, int, boolean, json, primaryKey as mysqlPrimaryKey } from 'drizzle-orm/mysql-core'

const isMysql = process.env.DB_TYPE === 'mysql'

const mysqlUsers = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
  geeIdUserId: varchar('geeid_user_id', { length: 64 }).unique()
})

const sqliteUsers = sqliteTable('users', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  createdAt: text('created_at').notNull(),
  geeIdUserId: text('geeid_user_id').unique()
})

export const users = isMysql ? mysqlUsers : sqliteUsers

const mysqlUserGroups = mysqlTable('user_groups', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: varchar('description', { length: 2048 }),
  isSystemDefault: boolean('is_system_default').notNull().default(false),
  permissions: json('permissions').$type<string[]>().notNull()
})

const sqliteUserGroups = sqliteTable('user_groups', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  isSystemDefault: integer('is_system_default', { mode: 'boolean' }).notNull().default(false),
  permissions: text('permissions', { mode: 'json' }).$type<string[]>().notNull()
})

export const userGroups = isMysql ? mysqlUserGroups : sqliteUserGroups

const mysqlGroupMembers = mysqlTable(
  'group_members',
  {
    userId: int('user_id')
      .notNull()
      .references(() => mysqlUsers.id, { onDelete: 'cascade' }),
    groupId: int('group_id')
      .notNull()
      .references(() => mysqlUserGroups.id, { onDelete: 'cascade' })
  },
  (t) => ({
    pk: mysqlPrimaryKey({ columns: [t.userId, t.groupId] })
  })
)

const sqliteGroupMembers = sqliteTable(
  'group_members',
  {
    userId: integer('user_id', { mode: 'number' })
      .notNull()
      .references(() => sqliteUsers.id, { onDelete: 'cascade' }),
    groupId: integer('group_id', { mode: 'number' })
      .notNull()
      .references(() => sqliteUserGroups.id, { onDelete: 'cascade' })
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.groupId] })
  })
)

export const groupMembers = isMysql ? mysqlGroupMembers : sqliteGroupMembers

const mysqlSessions = mysqlTable('sessions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: int('user_id')
    .notNull()
    .references(() => mysqlUsers.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  createdAt: varchar('created_at', { length: 64 }).notNull(),
  expiresAt: varchar('expires_at', { length: 64 }).notNull()
})

const sqliteSessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id', { mode: 'number' })
    .notNull()
    .references(() => sqliteUsers.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull()
})

export const sessions = isMysql ? mysqlSessions : sqliteSessions
