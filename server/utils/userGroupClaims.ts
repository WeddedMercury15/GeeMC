import { eq, inArray } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { Db } from './db'
import { groupMembers, userGroups } from '../database/schema'
import {
  ALL_PERMISSION_KEYS,
  expandPermissionToken,
  mergeSystemPermissionsForSlug,
  normalizeGroupSlug
} from '../constants/geemc-groups'
import { resolveUserAvatarUrl } from './avatarUrl'
import { mergeGeeUserinfoFromCookie } from './geeIdOAuth'

const DEFAULT_GROUPS = [
  {
    name: 'Super Admin',
    slug: 'super_admin',
    description: 'Full access to the site.',
    isSystemDefault: true,
    permissions: ['*'] as string[]
  },
  {
    name: 'Administrator',
    slug: 'administrator',
    description: 'Manage content and settings.',
    isSystemDefault: true,
    permissions: ['geemc.publish', 'geemc.admin'] as string[]
  },
  {
    name: 'Registered User',
    slug: 'registered_user',
    description: 'Standard user access.',
    isSystemDefault: true,
    permissions: [] as string[]
  }
] as const

export async function ensureDefaultUserGroups(db: Db) {
  const existing = await db.select().from(userGroups).limit(1)
  if (existing.length > 0) {
    return
  }
  await db.insert(userGroups).values([...DEFAULT_GROUPS])
}

export async function getGroupIdBySlug(db: Db, slug: string): Promise<number | null> {
  const rows = await db.select().from(userGroups).where(eq(userGroups.slug, slug)).limit(1)
  const r = rows[0] as { id: number } | undefined
  return r?.id != null ? Number(r.id) : null
}

export async function addUserToGroup(db: Db, userId: number, groupId: number) {
  await db.insert(groupMembers).values({ userId, groupId }).onConflictDoNothing()
}

const GROUP_DISPLAY_ORDER = ['super_admin', 'administrator', 'registered_user'] as const

function sortGroupsForDisplay(
  rows: { slug: string, name: string, permissions: unknown }[]
): { slug: string, name: string, permissions: unknown }[] {
  return [...rows].sort((a, b) => {
    const na = normalizeGroupSlug(String(a.slug))
    const nb = normalizeGroupSlug(String(b.slug))
    const ia = GROUP_DISPLAY_ORDER.indexOf(na as (typeof GROUP_DISPLAY_ORDER)[number])
    const ib = GROUP_DISPLAY_ORDER.indexOf(nb as (typeof GROUP_DISPLAY_ORDER)[number])
    const pa = ia === -1 ? 100 : ia
    const pb = ib === -1 ? 100 : ib
    if (pa !== pb) return pa - pb
    return String(a.name).localeCompare(String(b.name))
  })
}

export async function resolveUserGroupClaims(db: Db, userId: number): Promise<{
  groupSlugs: string[]
  groupNames: string[]
  permissions: string[]
}> {
  const memberRows = await db.select().from(groupMembers).where(eq(groupMembers.userId, userId))
  const groupIds = [...new Set(memberRows.map(m => Number((m as { groupId: number }).groupId)))]
  if (groupIds.length === 0) {
    return { groupSlugs: [], groupNames: [], permissions: [] }
  }

  const raw = await db
    .select()
    .from(userGroups)
    .where(inArray(userGroups.id as never, groupIds)) as { slug: string, name: string, permissions: unknown }[]

  const groups = sortGroupsForDisplay(raw)

  const permSet = new Set<string>()
  const groupSlugs: string[] = []
  const groupNames: string[] = []

  for (const g of groups) {
    groupSlugs.push(String(g.slug))
    groupNames.push(String(g.name))
    const slugNorm = normalizeGroupSlug(String(g.slug))
    if (slugNorm === 'super_admin') {
      for (const k of ALL_PERMISSION_KEYS) permSet.add(k)
      continue
    }
    const dbPerms = Array.isArray(g.permissions) ? (g.permissions as string[]) : []
    for (const p of dbPerms) {
      expandPermissionToken(p, permSet)
    }
    mergeSystemPermissionsForSlug(String(g.slug), permSet)
  }

  return {
    groupSlugs,
    groupNames,
    permissions: Array.from(permSet)
  }
}

export async function formatAuthUserForClient(
  db: Db,
  user: {
    id: number
    username: string
    geeIdUserId?: string | null
  },
  event?: H3Event
) {
  const claims = await resolveUserGroupClaims(db, user.id)
  const avatar = resolveUserAvatarUrl(null, user.geeIdUserId ?? null)
  const username = user.username
  let email: string | null = null
  if (event && user.geeIdUserId?.trim()) {
    const merged = await mergeGeeUserinfoFromCookie(event, user.geeIdUserId, {
      username,
      email,
      avatar
    })
    email = merged.email
  }
  return {
    id: user.id,
    username,
    email,
    avatar,
    groups: claims.groupNames,
    permissions: claims.permissions
  }
}
