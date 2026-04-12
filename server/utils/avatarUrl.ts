export const GEE_ID_PUBLIC_AVATAR_BASE = 'https://id.geeroam.com/api/public/avatar'

export function resolveUserAvatarUrl(
  storedAvatar: string | null | undefined,
  geeIdUserId?: string | null
): string | null {
  const t = storedAvatar?.trim()
  if (t) return t
  const gid = geeIdUserId?.trim()
  if (gid) return `${GEE_ID_PUBLIC_AVATAR_BASE}/${encodeURIComponent(gid)}`
  return null
}
