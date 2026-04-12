export const GEEMC_PERMISSION_KEYS = ['geemc.publish', 'geemc.admin'] as const

export type GeemcPermissionKey = (typeof GEEMC_PERMISSION_KEYS)[number]

export const ALL_PERMISSION_KEYS: string[] = [...GEEMC_PERMISSION_KEYS]

export function normalizeGroupSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

export const SYSTEM_GROUP_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['*'],
  administrator: ['geemc.publish', 'geemc.admin'],
  registered_user: []
}

export function expandPermissionToken(token: string, into: Set<string>) {
  if (token === '*') {
    for (const k of ALL_PERMISSION_KEYS) {
      into.add(k)
    }
  } else {
    into.add(token)
  }
}

export function mergeSystemPermissionsForSlug(slug: string, into: Set<string>) {
  const n = normalizeGroupSlug(slug)
  const sys = SYSTEM_GROUP_PERMISSIONS[n]
  if (!sys) return
  for (const p of sys) {
    expandPermissionToken(p, into)
  }
}
