import { sqliteTable, text, integer, primaryKey, unique as sqliteUnique } from 'drizzle-orm/sqlite-core'
import {
  mysqlTable,
  varchar,
  int,
  boolean,
  json,
  primaryKey as mysqlPrimaryKey,
  text as mysqlText,
  unique as mysqlUnique
} from 'drizzle-orm/mysql-core'

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
  t => ({
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
  t => ({
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

export const mysqlResources = mysqlTable('resources', {
  id: varchar('id', { length: 64 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  tagLine: varchar('tag_line', { length: 255 }).notNull().default(''),
  /** @deprecated Prefer facet selections; kept for legacy list routes and templates. */
  categoryKey: varchar('category_key', { length: 100 }).notNull(),
  /** @deprecated Maps loosely to edition; replaced by `edition`. */
  platformKey: varchar('platform_key', { length: 100 }).notNull(),
  /** Top segment: `java` | `bedrock` */
  edition: varchar('edition', { length: 16 }).notNull().default('java'),
  /** Content kind within the edition, e.g. `mod`, `plugin`, `datapack`. */
  kind: varchar('kind', { length: 64 }).notNull().default('mod'),
  /** Intended runtime side: `client` | `server` | `both`. */
  environment: varchar('environment', { length: 16 }).notNull().default('both'),
  resourceType: varchar('resource_type', { length: 25 }).notNull().default('download'),
  resourceState: varchar('resource_state', { length: 16 }).notNull().default('visible'),
  externalUrl: varchar('external_url', { length: 2000 }).notNull().default(''),
  externalPurchaseUrl: varchar('external_purchase_url', { length: 2000 }).notNull().default(''),
  price: int('price').notNull().default(0),
  currency: varchar('currency', { length: 8 }).notNull().default(''),
  currentVersionId: int('current_version_id').notNull().default(0),
  descriptionUpdateId: int('description_update_id').notNull().default(0),
  viewCount: int('view_count').notNull().default(0),
  updateCount: int('update_count').notNull().default(0),
  reviewCount: int('review_count').notNull().default(0),
  lastUpdate: varchar('last_update', { length: 64 }).notNull().default(''),
  supportUrl: varchar('support_url', { length: 2000 }).notNull().default(''),
  customFields: json('custom_fields').$type<Record<string, string>>(),
  prefixId: int('prefix_id').notNull().default(0),
  iconDate: varchar('icon_date', { length: 64 }).notNull().default('0'),
  featured: boolean('featured').notNull().default(false),
  teamMemberUserIds: json('team_member_user_ids').$type<number[]>(),
  description: mysqlText('description').notNull(),
  descriptionHtml: mysqlText('description_html').notNull(),
  cover: varchar('cover_url', { length: 1000 }).notNull(),
  icon: varchar('icon_url', { length: 1000 }).notNull(),
  authorUserId: int('author_user_id').notNull().references(() => mysqlUsers.id, { onDelete: 'cascade' }),
  createDate: varchar('create_date', { length: 64 }).notNull(),
  updateDate: varchar('update_date', { length: 64 }).notNull(),
  publishedAt: varchar('published_at', { length: 64 }).notNull(),
  downloadsCount: int('downloads_count').notNull().default(0),
  followersCount: int('followers_count').notNull().default(0),
  tags: json('tags').$type<string[]>().notNull(),
  licenseName: varchar('license_name', { length: 255 }),
  licenseUrl: varchar('license_url', { length: 1000 })
})

export const sqliteResources = sqliteTable('resources', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  tagLine: text('tag_line').notNull().default(''),
  categoryKey: text('category_key').notNull(),
  platformKey: text('platform_key').notNull(),
  edition: text('edition').notNull().default('java'),
  kind: text('kind').notNull().default('mod'),
  environment: text('environment').notNull().default('both'),
  resourceType: text('resource_type').notNull().default('download'),
  resourceState: text('resource_state').notNull().default('visible'),
  externalUrl: text('external_url').notNull().default(''),
  externalPurchaseUrl: text('external_purchase_url').notNull().default(''),
  price: integer('price', { mode: 'number' }).notNull().default(0),
  currency: text('currency').notNull().default(''),
  currentVersionId: integer('current_version_id', { mode: 'number' }).notNull().default(0),
  descriptionUpdateId: integer('description_update_id', { mode: 'number' }).notNull().default(0),
  viewCount: integer('view_count', { mode: 'number' }).notNull().default(0),
  updateCount: integer('update_count', { mode: 'number' }).notNull().default(0),
  reviewCount: integer('review_count', { mode: 'number' }).notNull().default(0),
  lastUpdate: text('last_update').notNull().default(''),
  supportUrl: text('support_url').notNull().default(''),
  customFields: text('custom_fields', { mode: 'json' }).$type<Record<string, string>>(),
  prefixId: integer('prefix_id', { mode: 'number' }).notNull().default(0),
  iconDate: text('icon_date').notNull().default('0'),
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
  teamMemberUserIds: text('team_member_user_ids', { mode: 'json' }).$type<number[]>(),
  description: text('description').notNull(),
  descriptionHtml: text('description_html').notNull(),
  cover: text('cover_url').notNull(),
  icon: text('icon_url').notNull(),
  authorUserId: integer('author_user_id', { mode: 'number' })
    .notNull()
    .references(() => sqliteUsers.id, { onDelete: 'cascade' }),
  createDate: text('create_date').notNull(),
  updateDate: text('update_date').notNull(),
  publishedAt: text('published_at').notNull(),
  downloadsCount: integer('downloads_count', { mode: 'number' }).notNull().default(0),
  followersCount: integer('followers_count', { mode: 'number' }).notNull().default(0),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull(),
  licenseName: text('license_name'),
  licenseUrl: text('license_url')
})

export const resources = isMysql ? mysqlResources : sqliteResources

export const mysqlResourceVersions = mysqlTable('resource_versions', {
  id: int('id').autoincrement().primaryKey(),
  resourceId: varchar('resource_id', { length: 64 }).notNull().references(() => mysqlResources.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 16 }).notNull(),
  date: varchar('date', { length: 64 }).notNull(),
  size: varchar('size', { length: 64 }).notNull(),
  downloadsCount: int('downloads_count').notNull().default(0),
  hash: varchar('hash', { length: 255 }).unique(),
  gameVersions: json('game_versions').$type<string[]>().notNull(),
  loaders: json('loaders').$type<string[]>().notNull(),
  serverTypes: json('server_types').$type<string[]>().notNull()
})

export const sqliteResourceVersions = sqliteTable('resource_versions', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  resourceId: text('resource_id').notNull().references(() => sqliteResources.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  date: text('date').notNull(),
  size: text('size').notNull(),
  downloadsCount: integer('downloads_count', { mode: 'number' }).notNull().default(0),
  hash: text('hash').unique(),
  gameVersions: text('game_versions', { mode: 'json' }).$type<string[]>().notNull(),
  loaders: text('loaders', { mode: 'json' }).$type<string[]>().notNull(),
  serverTypes: text('server_types', { mode: 'json' }).$type<string[]>().notNull()
})

export const resourceVersions = isMysql ? mysqlResourceVersions : sqliteResourceVersions

export const mysqlResourceVersionFiles = mysqlTable('resource_version_files', {
  id: int('id').autoincrement().primaryKey(),
  resourceId: varchar('resource_id', { length: 64 }).notNull().references(() => mysqlResources.id, { onDelete: 'cascade' }),
  versionId: int('version_id').notNull().references(() => mysqlResourceVersions.id, { onDelete: 'cascade' }),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull().default(''),
  mimeType: varchar('mime_type', { length: 120 }).notNull().default('application/octet-stream'),
  sizeBytes: int('size_bytes').notNull().default(0),
  sortOrder: int('sort_order').notNull().default(0),
  isPrimary: boolean('is_primary').notNull().default(false),
  storagePath: varchar('storage_path', { length: 1000 }).notNull(),
  publicUrl: varchar('public_url', { length: 1000 }).notNull(),
  createdAt: varchar('created_at', { length: 64 }).notNull()
})

export const sqliteResourceVersionFiles = sqliteTable('resource_version_files', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  resourceId: text('resource_id').notNull().references(() => sqliteResources.id, { onDelete: 'cascade' }),
  versionId: integer('version_id', { mode: 'number' }).notNull().references(() => sqliteResourceVersions.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  displayName: text('display_name').notNull().default(''),
  mimeType: text('mime_type').notNull().default('application/octet-stream'),
  sizeBytes: integer('size_bytes', { mode: 'number' }).notNull().default(0),
  sortOrder: integer('sort_order', { mode: 'number' }).notNull().default(0),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  storagePath: text('storage_path').notNull(),
  publicUrl: text('public_url').notNull(),
  createdAt: text('created_at').notNull()
})

export const resourceVersionFiles = isMysql ? mysqlResourceVersionFiles : sqliteResourceVersionFiles

/** Admin-defined facet groups (game version, loader, theme category, future Modrinth-like filters). */
const mysqlFacetDefinitions = mysqlTable('facet_definitions', {
  id: int('id').autoincrement().primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  allowsIcon: boolean('allows_icon').notNull().default(false),
  /** Whether values are attached to the resource row or each `resource_versions` row. */
  appliesToLevel: varchar('applies_to_level', { length: 16 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0)
})

const sqliteFacetDefinitions = sqliteTable('facet_definitions', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  allowsIcon: integer('allows_icon', { mode: 'boolean' }).notNull().default(false),
  appliesToLevel: text('applies_to_level').notNull(),
  sortOrder: integer('sort_order', { mode: 'number' }).notNull().default(0)
})

export const facetDefinitions = isMysql ? mysqlFacetDefinitions : sqliteFacetDefinitions

/**
 * Limits a facet to specific `resources.edition` + `resources.kind` pairs.
 * Use `*` in `kind` to match any kind within that edition.
 */
const mysqlFacetDefinitionScopes = mysqlTable(
  'facet_definition_scopes',
  {
    facetDefinitionId: int('facet_definition_id')
      .notNull()
      .references(() => mysqlFacetDefinitions.id, { onDelete: 'cascade' }),
    edition: varchar('edition', { length: 16 }).notNull(),
    kind: varchar('kind', { length: 64 }).notNull()
  },
  t => ({
    pk: mysqlPrimaryKey({ columns: [t.facetDefinitionId, t.edition, t.kind] })
  })
)

const sqliteFacetDefinitionScopes = sqliteTable(
  'facet_definition_scopes',
  {
    facetDefinitionId: integer('facet_definition_id', { mode: 'number' })
      .notNull()
      .references(() => sqliteFacetDefinitions.id, { onDelete: 'cascade' }),
    edition: text('edition').notNull(),
    kind: text('kind').notNull()
  },
  t => ({
    pk: primaryKey({ columns: [t.facetDefinitionId, t.edition, t.kind] })
  })
)

export const facetDefinitionScopes = isMysql ? mysqlFacetDefinitionScopes : sqliteFacetDefinitionScopes

const mysqlFacetValues = mysqlTable(
  'facet_values',
  {
    id: int('id').autoincrement().primaryKey(),
    facetDefinitionId: int('facet_definition_id')
      .notNull()
      .references(() => mysqlFacetDefinitions.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 100 }).notNull(),
    label: varchar('label', { length: 255 }).notNull(),
    iconUrl: varchar('icon_url', { length: 1000 }),
    sortOrder: int('sort_order').notNull().default(0)
  },
  t => ({
    slugPerFacet: mysqlUnique('facet_values_facet_slug').on(t.facetDefinitionId, t.slug)
  })
)

const sqliteFacetValues = sqliteTable(
  'facet_values',
  {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    facetDefinitionId: integer('facet_definition_id', { mode: 'number' })
      .notNull()
      .references(() => sqliteFacetDefinitions.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    label: text('label').notNull(),
    iconUrl: text('icon_url'),
    sortOrder: integer('sort_order', { mode: 'number' }).notNull().default(0)
  },
  t => ({
    slugPerFacet: sqliteUnique('facet_values_facet_slug').on(t.facetDefinitionId, t.slug)
  })
)

export const facetValues = isMysql ? mysqlFacetValues : sqliteFacetValues

const mysqlResourceFacetValues = mysqlTable(
  'resource_facet_values',
  {
    resourceId: varchar('resource_id', { length: 64 })
      .notNull()
      .references(() => mysqlResources.id, { onDelete: 'cascade' }),
    facetValueId: int('facet_value_id')
      .notNull()
      .references(() => mysqlFacetValues.id, { onDelete: 'cascade' })
  },
  t => ({
    pk: mysqlPrimaryKey({ columns: [t.resourceId, t.facetValueId] })
  })
)

const sqliteResourceFacetValues = sqliteTable(
  'resource_facet_values',
  {
    resourceId: text('resource_id')
      .notNull()
      .references(() => sqliteResources.id, { onDelete: 'cascade' }),
    facetValueId: integer('facet_value_id', { mode: 'number' })
      .notNull()
      .references(() => sqliteFacetValues.id, { onDelete: 'cascade' })
  },
  t => ({
    pk: primaryKey({ columns: [t.resourceId, t.facetValueId] })
  })
)

export const resourceFacetValues = isMysql ? mysqlResourceFacetValues : sqliteResourceFacetValues

const mysqlResourceVersionFacetValues = mysqlTable(
  'resource_version_facet_values',
  {
    resourceVersionId: int('resource_version_id')
      .notNull()
      .references(() => mysqlResourceVersions.id, { onDelete: 'cascade' }),
    facetValueId: int('facet_value_id')
      .notNull()
      .references(() => mysqlFacetValues.id, { onDelete: 'cascade' })
  },
  t => ({
    pk: mysqlPrimaryKey({ columns: [t.resourceVersionId, t.facetValueId] })
  })
)

const sqliteResourceVersionFacetValues = sqliteTable(
  'resource_version_facet_values',
  {
    resourceVersionId: integer('resource_version_id', { mode: 'number' })
      .notNull()
      .references(() => sqliteResourceVersions.id, { onDelete: 'cascade' }),
    facetValueId: integer('facet_value_id', { mode: 'number' })
      .notNull()
      .references(() => sqliteFacetValues.id, { onDelete: 'cascade' })
  },
  t => ({
    pk: primaryKey({ columns: [t.resourceVersionId, t.facetValueId] })
  })
)

export const resourceVersionFacetValues = isMysql ? mysqlResourceVersionFacetValues : sqliteResourceVersionFacetValues

export const mysqlResourceUpdates = mysqlTable('resource_updates', {
  id: int('id').autoincrement().primaryKey(),
  resourceId: varchar('resource_id', { length: 64 }).notNull().references(() => mysqlResources.id, { onDelete: 'cascade' }),
  resourceVersionId: int('resource_version_id').references(() => mysqlResourceVersions.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull().default(''),
  message: mysqlText('message').notNull(),
  messageHtml: mysqlText('message_html').notNull(),
  postDate: varchar('post_date', { length: 64 }).notNull(),
  updateType: varchar('update_type', { length: 32 }).notNull().default('update'),
  isDescription: boolean('is_description').notNull().default(false),
  versionString: varchar('version_string', { length: 255 }).notNull().default(''),
  messageState: varchar('message_state', { length: 16 }).notNull().default('visible')
})

export const sqliteResourceUpdates = sqliteTable('resource_updates', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  resourceId: text('resource_id').notNull().references(() => sqliteResources.id, { onDelete: 'cascade' }),
  resourceVersionId: integer('resource_version_id', { mode: 'number' }).references(() => sqliteResourceVersions.id, { onDelete: 'set null' }),
  title: text('title').notNull().default(''),
  message: text('message').notNull(),
  messageHtml: text('message_html').notNull(),
  postDate: text('post_date').notNull(),
  updateType: text('update_type').notNull().default('update'),
  isDescription: integer('is_description', { mode: 'boolean' }).notNull().default(false),
  versionString: text('version_string').notNull().default(''),
  messageState: text('message_state').notNull().default('visible')
})

export const resourceUpdates = isMysql ? mysqlResourceUpdates : sqliteResourceUpdates

export const mysqlResourceModerationLogs = mysqlTable('resource_moderation_logs', {
  id: int('id').autoincrement().primaryKey(),
  resourceId: varchar('resource_id', { length: 64 }).notNull().references(() => mysqlResources.id, { onDelete: 'cascade' }),
  actorUserId: int('actor_user_id').notNull().references(() => mysqlUsers.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 32 }).notNull(),
  source: varchar('source', { length: 32 }).notNull().default('unknown'),
  fromState: varchar('from_state', { length: 16 }).notNull(),
  toState: varchar('to_state', { length: 16 }).notNull(),
  reason: varchar('reason', { length: 1000 }).notNull().default(''),
  createdAt: varchar('created_at', { length: 64 }).notNull()
})

export const sqliteResourceModerationLogs = sqliteTable('resource_moderation_logs', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  resourceId: text('resource_id').notNull().references(() => sqliteResources.id, { onDelete: 'cascade' }),
  actorUserId: integer('actor_user_id', { mode: 'number' }).notNull().references(() => sqliteUsers.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  source: text('source').notNull().default('unknown'),
  fromState: text('from_state').notNull(),
  toState: text('to_state').notNull(),
  reason: text('reason').notNull().default(''),
  createdAt: text('created_at').notNull()
})

export const resourceModerationLogs = isMysql ? mysqlResourceModerationLogs : sqliteResourceModerationLogs

export const mysqlResourceChangelogs = mysqlTable('resource_changelogs', {
  id: int('id').autoincrement().primaryKey(),
  resourceId: varchar('resource_id', { length: 64 }).notNull().references(() => mysqlResources.id, { onDelete: 'cascade' }),
  version: varchar('version', { length: 255 }).notNull(),
  type: varchar('type', { length: 16 }).notNull(),
  date: varchar('date', { length: 64 }).notNull(),
  markdownHtml: mysqlText('markdown_html').notNull()
})

export const sqliteResourceChangelogs = sqliteTable('resource_changelogs', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  resourceId: text('resource_id').notNull().references(() => sqliteResources.id, { onDelete: 'cascade' }),
  version: text('version').notNull(),
  type: text('type').notNull(),
  date: text('date').notNull(),
  markdownHtml: text('markdown_html').notNull()
})

export const resourceChangelogs = isMysql ? mysqlResourceChangelogs : sqliteResourceChangelogs

export const mysqlResourceGallery = mysqlTable('resource_gallery', {
  id: int('id').autoincrement().primaryKey(),
  resourceId: varchar('resource_id', { length: 64 }).notNull().references(() => mysqlResources.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 1000 }).notNull(),
  caption: varchar('caption', { length: 255 })
})

export const sqliteResourceGallery = sqliteTable('resource_gallery', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  resourceId: text('resource_id').notNull().references(() => sqliteResources.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  caption: text('caption')
})

export const resourceGallery = isMysql ? mysqlResourceGallery : sqliteResourceGallery

export const mysqlResourceLinks = mysqlTable('resource_links', {
  id: int('id').autoincrement().primaryKey(),
  resourceId: varchar('resource_id', { length: 64 }).notNull().references(() => mysqlResources.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 255 }).notNull(),
  url: varchar('url', { length: 2000 }).notNull(),
  icon: varchar('icon', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 })
})

export const sqliteResourceLinks = sqliteTable('resource_links', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  resourceId: text('resource_id').notNull().references(() => sqliteResources.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  url: text('url').notNull(),
  icon: text('icon').notNull(),
  type: text('type')
})

export const resourceLinks = isMysql ? mysqlResourceLinks : sqliteResourceLinks

export const mysqlResourceReviews = mysqlTable('resource_reviews', {
  id: int('id').autoincrement().primaryKey(),
  resourceId: varchar('resource_id', { length: 64 }).notNull().references(() => mysqlResources.id, { onDelete: 'cascade' }),
  userId: int('user_id').notNull().references(() => mysqlUsers.id, { onDelete: 'cascade' }),
  rating: int('rating').notNull(),
  content: mysqlText('content').notNull(),
  likes: int('likes').notNull().default(0),
  reviewState: varchar('review_state', { length: 16 }).notNull().default('visible'),
  time: varchar('time', { length: 64 }).notNull()
})

export const sqliteResourceReviews = sqliteTable('resource_reviews', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  resourceId: text('resource_id').notNull().references(() => sqliteResources.id, { onDelete: 'cascade' }),
  userId: integer('user_id', { mode: 'number' })
    .notNull()
    .references(() => sqliteUsers.id, { onDelete: 'cascade' }),
  rating: integer('rating', { mode: 'number' }).notNull(),
  content: text('content').notNull(),
  likes: integer('likes', { mode: 'number' }).notNull().default(0),
  reviewState: text('review_state').notNull().default('visible'),
  time: text('time').notNull()
})

export const resourceReviews = isMysql ? mysqlResourceReviews : sqliteResourceReviews

export const mysqlResourceReviewReplies = mysqlTable(
  'resource_review_replies',
  {
    reviewId: int('review_id')
      .notNull()
      .references(() => mysqlResourceReviews.id, { onDelete: 'cascade' }),
    replierUserId: int('replier_user_id')
      .notNull()
      .references(() => mysqlUsers.id, { onDelete: 'cascade' }),
    message: mysqlText('message').notNull(),
    createdAt: varchar('created_at', { length: 64 }).notNull(),
    updatedAt: varchar('updated_at', { length: 64 }).notNull()
  },
  t => ({
    pk: mysqlPrimaryKey({ columns: [t.reviewId] })
  })
)

export const sqliteResourceReviewReplies = sqliteTable(
  'resource_review_replies',
  {
    reviewId: integer('review_id', { mode: 'number' })
      .notNull()
      .references(() => sqliteResourceReviews.id, { onDelete: 'cascade' }),
    replierUserId: integer('replier_user_id', { mode: 'number' })
      .notNull()
      .references(() => sqliteUsers.id, { onDelete: 'cascade' }),
    message: text('message').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  t => ({
    pk: primaryKey({ columns: [t.reviewId] })
  })
)

export const resourceReviewReplies = isMysql ? mysqlResourceReviewReplies : sqliteResourceReviewReplies

export const mysqlResourceReviewVotes = mysqlTable(
  'resource_review_votes',
  {
    reviewId: int('review_id')
      .notNull()
      .references(() => mysqlResourceReviews.id, { onDelete: 'cascade' }),
    userId: int('user_id')
      .notNull()
      .references(() => mysqlUsers.id, { onDelete: 'cascade' }),
    createdAt: varchar('created_at', { length: 64 }).notNull()
  },
  t => ({
    pk: mysqlPrimaryKey({ columns: [t.reviewId, t.userId] })
  })
)

export const sqliteResourceReviewVotes = sqliteTable(
  'resource_review_votes',
  {
    reviewId: integer('review_id', { mode: 'number' })
      .notNull()
      .references(() => sqliteResourceReviews.id, { onDelete: 'cascade' }),
    userId: integer('user_id', { mode: 'number' })
      .notNull()
      .references(() => sqliteUsers.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull()
  },
  t => ({
    pk: primaryKey({ columns: [t.reviewId, t.userId] })
  })
)

export const resourceReviewVotes = isMysql ? mysqlResourceReviewVotes : sqliteResourceReviewVotes

export const mysqlResourceUpdateVotes = mysqlTable(
  'resource_update_votes',
  {
    updateId: int('update_id')
      .notNull()
      .references(() => mysqlResourceUpdates.id, { onDelete: 'cascade' }),
    userId: int('user_id')
      .notNull()
      .references(() => mysqlUsers.id, { onDelete: 'cascade' }),
    createdAt: varchar('created_at', { length: 64 }).notNull()
  },
  t => ({
    pk: mysqlPrimaryKey({ columns: [t.updateId, t.userId] })
  })
)

export const sqliteResourceUpdateVotes = sqliteTable(
  'resource_update_votes',
  {
    updateId: integer('update_id', { mode: 'number' })
      .notNull()
      .references(() => sqliteResourceUpdates.id, { onDelete: 'cascade' }),
    userId: integer('user_id', { mode: 'number' })
      .notNull()
      .references(() => sqliteUsers.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull()
  },
  t => ({
    pk: primaryKey({ columns: [t.updateId, t.userId] })
  })
)

export const resourceUpdateVotes = isMysql ? mysqlResourceUpdateVotes : sqliteResourceUpdateVotes

export const mysqlResourceFollows = mysqlTable(
  'resource_follows',
  {
    userId: int('user_id').notNull().references(() => mysqlUsers.id, { onDelete: 'cascade' }),
    resourceId: varchar('resource_id', { length: 64 }).notNull().references(() => mysqlResources.id, { onDelete: 'cascade' }),
    createdAt: varchar('created_at', { length: 64 }).notNull(),
    lastReadAt: varchar('last_read_at', { length: 64 }).notNull().default('')
  },
  t => ({
    pk: mysqlPrimaryKey({ columns: [t.userId, t.resourceId] })
  })
)

export const sqliteResourceFollows = sqliteTable(
  'resource_follows',
  {
    userId: integer('user_id', { mode: 'number' }).notNull().references(() => sqliteUsers.id, { onDelete: 'cascade' }),
    resourceId: text('resource_id').notNull().references(() => sqliteResources.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
    lastReadAt: text('last_read_at').notNull().default('')
  },
  t => ({
    pk: primaryKey({ columns: [t.userId, t.resourceId] })
  })
)

export const resourceFollows = isMysql ? mysqlResourceFollows : sqliteResourceFollows

export const mysqlUserNotifications = mysqlTable('user_notifications', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull().references(() => mysqlUsers.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 64 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: mysqlText('message').notNull(),
  resourceId: varchar('resource_id', { length: 64 }),
  readAt: varchar('read_at', { length: 64 }).notNull().default(''),
  createdAt: varchar('created_at', { length: 64 }).notNull()
})

export const sqliteUserNotifications = sqliteTable('user_notifications', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer('user_id', { mode: 'number' }).notNull().references(() => sqliteUsers.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  resourceId: text('resource_id'),
  readAt: text('read_at').notNull().default(''),
  createdAt: text('created_at').notNull()
})

export const userNotifications = isMysql ? mysqlUserNotifications : sqliteUserNotifications

const mysqlResourceTemplates = mysqlTable('resource_templates', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  cardAspectRatio: varchar('card_aspect_ratio', { length: 32 }).notNull().default('16/9')
})

const sqliteResourceTemplates = sqliteTable('resource_templates', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  key: text('key').notNull().unique(),
  cardAspectRatio: text('card_aspect_ratio').notNull().default('16/9')
})

export const resourceTemplates = isMysql ? mysqlResourceTemplates : sqliteResourceTemplates

const mysqlResourceCategories = mysqlTable('resource_categories', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: varchar('description', { length: 2048 }),
  resourceCount: int('resource_count').notNull().default(0),
  lastUpdate: varchar('last_update', { length: 64 }).notNull().default('0'),
  lastResourceTitle: varchar('last_resource_title', { length: 255 }).notNull().default(''),
  lastResourceId: varchar('last_resource_id', { length: 64 }).notNull().default(''),
  fieldCache: json('field_cache').$type<string[]>().notNull(),
  reviewFieldCache: json('review_field_cache').$type<string[]>().notNull(),
  prefixCache: json('prefix_cache').$type<number[]>().notNull(),
  requirePrefix: boolean('require_prefix').notNull().default(false),
  allowLocal: boolean('allow_local').notNull().default(true),
  allowExternal: boolean('allow_external').notNull().default(true),
  allowCommercialExternal: boolean('allow_commercial_external').notNull().default(false),
  allowFileless: boolean('allow_fileless').notNull().default(true),
  alwaysModerateCreate: boolean('always_moderate_create').notNull().default(false),
  alwaysModerateUpdate: boolean('always_moderate_update').notNull().default(false),
  minTags: int('min_tags').notNull().default(0),
  enableVersioning: boolean('enable_versioning').notNull().default(true),
  enableSupportUrl: boolean('enable_support_url').notNull().default(true),
  autoFeature: boolean('auto_feature').notNull().default(false),
  parentCategoryId: int('parent_category_id').notNull().default(0),
  displayOrder: int('display_order').notNull().default(1),
  icon: varchar('icon', { length: 128 }).notNull().default('i-lucide-folder'),
  templateId: int('template_id')
    .notNull()
    .references(() => mysqlResourceTemplates.id, { onDelete: 'restrict' })
})

const sqliteResourceCategories = sqliteTable('resource_categories', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  resourceCount: integer('resource_count', { mode: 'number' }).notNull().default(0),
  lastUpdate: text('last_update').notNull().default('0'),
  lastResourceTitle: text('last_resource_title').notNull().default(''),
  lastResourceId: text('last_resource_id').notNull().default(''),
  fieldCache: text('field_cache', { mode: 'json' }).$type<string[]>().notNull(),
  reviewFieldCache: text('review_field_cache', { mode: 'json' }).$type<string[]>().notNull(),
  prefixCache: text('prefix_cache', { mode: 'json' }).$type<number[]>().notNull(),
  requirePrefix: integer('require_prefix', { mode: 'boolean' }).notNull().default(false),
  allowLocal: integer('allow_local', { mode: 'boolean' }).notNull().default(true),
  allowExternal: integer('allow_external', { mode: 'boolean' }).notNull().default(true),
  allowCommercialExternal: integer('allow_commercial_external', { mode: 'boolean' }).notNull().default(false),
  allowFileless: integer('allow_fileless', { mode: 'boolean' }).notNull().default(true),
  alwaysModerateCreate: integer('always_moderate_create', { mode: 'boolean' }).notNull().default(false),
  alwaysModerateUpdate: integer('always_moderate_update', { mode: 'boolean' }).notNull().default(false),
  minTags: integer('min_tags', { mode: 'number' }).notNull().default(0),
  enableVersioning: integer('enable_versioning', { mode: 'boolean' }).notNull().default(true),
  enableSupportUrl: integer('enable_support_url', { mode: 'boolean' }).notNull().default(true),
  autoFeature: integer('auto_feature', { mode: 'boolean' }).notNull().default(false),
  parentCategoryId: integer('parent_category_id', { mode: 'number' }).notNull().default(0),
  displayOrder: integer('display_order', { mode: 'number' }).notNull().default(1),
  icon: text('icon').notNull().default('i-lucide-folder'),
  templateId: integer('template_id', { mode: 'number' })
    .notNull()
    .references(() => sqliteResourceTemplates.id, { onDelete: 'restrict' })
})

export const resourceCategories = isMysql ? mysqlResourceCategories : sqliteResourceCategories

import type { ResourceFieldChoiceRecord } from '../utils/resourceFieldChoices'

const mysqlResourceFields = mysqlTable('resource_fields', {
  id: varchar('id', { length: 25 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: varchar('description', { length: 1024 }).notNull().default(''),
  displayGroup: varchar('display_group', { length: 255 }).notNull().default('above_info'),
  displayOrder: int('display_order').notNull().default(1),
  fieldScope: varchar('field_scope', { length: 25 }).notNull().default('resource'),
  fieldType: varchar('field_type', { length: 25 }).notNull().default('textbox'),
  fieldChoices: json('field_choices').$type<ResourceFieldChoiceRecord>().notNull(),
  matchType: varchar('match_type', { length: 25 }).notNull().default('none'),
  matchParams: json('match_params').$type<Record<string, string>>().notNull(),
  required: boolean('required').notNull().default(false),
  maxLength: int('max_length').notNull().default(0),
  versionFilterable: boolean('version_filterable').notNull().default(false),
  viewableResource: boolean('viewable_resource').notNull().default(true)
})

const sqliteResourceFields = sqliteTable('resource_fields', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  displayGroup: text('display_group').notNull().default('above_info'),
  displayOrder: integer('display_order', { mode: 'number' }).notNull().default(1),
  fieldScope: text('field_scope').notNull().default('resource'),
  fieldType: text('field_type').notNull().default('textbox'),
  fieldChoices: text('field_choices', { mode: 'json' }).$type<ResourceFieldChoiceRecord>().notNull(),
  matchType: text('match_type').notNull().default('none'),
  matchParams: text('match_params', { mode: 'json' }).$type<Record<string, string>>().notNull(),
  required: integer('required', { mode: 'boolean' }).notNull().default(false),
  maxLength: integer('max_length', { mode: 'number' }).notNull().default(0),
  versionFilterable: integer('version_filterable', { mode: 'boolean' }).notNull().default(false),
  viewableResource: integer('viewable_resource', { mode: 'boolean' }).notNull().default(true)
})

export const resourceFields = isMysql ? mysqlResourceFields : sqliteResourceFields

const mysqlCategoryFields = mysqlTable(
  'category_fields',
  {
    categoryId: int('category_id')
      .notNull()
      .references(() => mysqlResourceCategories.id, { onDelete: 'cascade' }),
    fieldId: varchar('field_id', { length: 25 })
      .notNull()
      .references(() => mysqlResourceFields.id, { onDelete: 'cascade' })
  },
  t => ({
    pk: mysqlPrimaryKey({ columns: [t.categoryId, t.fieldId] })
  })
)

const sqliteCategoryFields = sqliteTable(
  'category_fields',
  {
    categoryId: integer('category_id', { mode: 'number' })
      .notNull()
      .references(() => sqliteResourceCategories.id, { onDelete: 'cascade' }),
    fieldId: text('field_id')
      .notNull()
      .references(() => sqliteResourceFields.id, { onDelete: 'cascade' })
  },
  t => ({
    pk: primaryKey({ columns: [t.categoryId, t.fieldId] })
  })
)

export const categoryFields = isMysql ? mysqlCategoryFields : sqliteCategoryFields

const mysqlResourceFieldValues = mysqlTable(
  'resource_field_values',
  {
    resourceId: varchar('resource_id', { length: 64 })
      .notNull()
      .references(() => mysqlResources.id, { onDelete: 'cascade' }),
    fieldId: varchar('field_id', { length: 25 })
      .notNull()
      .references(() => mysqlResourceFields.id, { onDelete: 'cascade' }),
    fieldValue: mysqlText('field_value').notNull()
  },
  t => ({
    pk: mysqlPrimaryKey({ columns: [t.resourceId, t.fieldId] })
  })
)

const sqliteResourceFieldValues = sqliteTable(
  'resource_field_values',
  {
    resourceId: text('resource_id')
      .notNull()
      .references(() => sqliteResources.id, { onDelete: 'cascade' }),
    fieldId: text('field_id')
      .notNull()
      .references(() => sqliteResourceFields.id, { onDelete: 'cascade' }),
    fieldValue: text('field_value').notNull()
  },
  t => ({
    pk: primaryKey({ columns: [t.resourceId, t.fieldId] })
  })
)

export const resourceFieldValues = isMysql ? mysqlResourceFieldValues : sqliteResourceFieldValues

const mysqlResourceVersionFieldValues = mysqlTable(
  'resource_version_field_values',
  {
    resourceVersionId: int('resource_version_id')
      .notNull()
      .references(() => mysqlResourceVersions.id, { onDelete: 'cascade' }),
    fieldId: varchar('field_id', { length: 25 })
      .notNull()
      .references(() => mysqlResourceFields.id, { onDelete: 'cascade' }),
    fieldValue: mysqlText('field_value').notNull()
  },
  t => ({
    pk: mysqlPrimaryKey({ columns: [t.resourceVersionId, t.fieldId] })
  })
)

const sqliteResourceVersionFieldValues = sqliteTable(
  'resource_version_field_values',
  {
    resourceVersionId: integer('resource_version_id', { mode: 'number' })
      .notNull()
      .references(() => sqliteResourceVersions.id, { onDelete: 'cascade' }),
    fieldId: text('field_id')
      .notNull()
      .references(() => sqliteResourceFields.id, { onDelete: 'cascade' }),
    fieldValue: text('field_value').notNull()
  },
  t => ({
    pk: primaryKey({ columns: [t.resourceVersionId, t.fieldId] })
  })
)

export const resourceVersionFieldValues = isMysql ? mysqlResourceVersionFieldValues : sqliteResourceVersionFieldValues
