import { getCookie, getRequestURL, type H3Event } from 'h3'

export const GEE_ID_AUTHORIZE_URL = 'https://id.geeroam.com/oauth2/authorize'
export const GEE_ID_TOKEN_URL = 'https://id.geeroam.com/api/oauth2/token'
export const GEE_ID_USERINFO_URL = 'https://id.geeroam.com/api/oauth2/userinfo'

/** Gee ID OAuth client credentials from environment (see .env.example). */
export function getGeeIdOAuthClientId(): string | undefined {
  const v = process.env.NUXT_GEE_ID_OAUTH_CLIENT_ID?.trim()
  return v || undefined
}

export function getGeeIdOAuthClientSecret(): string | undefined {
  const v = process.env.NUXT_GEE_ID_OAUTH_CLIENT_SECRET?.trim()
  return v || undefined
}

export function getGeeIdOAuthRedirectUri(event: H3Event): string {
  const configured = process.env.NUXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') ?? ''
  if (configured) {
    return `${configured}/api/auth/geeid/callback`
  }
  const u = getRequestURL(event)
  return `${u.protocol}//${u.host}/api/auth/geeid/callback`
}

export function extractAccessToken(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const o = body as Record<string, unknown>
  if (typeof o.access_token === 'string') return o.access_token
  const data = o.data
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (typeof d.access_token === 'string') return d.access_token
    if (typeof d.accessToken === 'string') return d.accessToken
  }
  return null
}

export type GeeIdProfile = {
  id: string
  username: string
  email: string | null
  avatar: string | null
}

export function parseGeeIdUserinfo(body: unknown): GeeIdProfile | null {
  if (!body || typeof body !== 'object') return null
  const o = body as Record<string, unknown>
  const data = (o.data && typeof o.data === 'object' ? o.data : o) as Record<string, unknown>
  if (data.id == null) return null
  const id = String(data.id)
  const username = typeof data.username === 'string' ? data.username.trim() : ''
  return {
    id,
    username: username || `gee_${id}`,
    email: typeof data.email === 'string' ? data.email.trim().toLowerCase() : null,
    avatar: typeof data.avatar === 'string' ? data.avatar : null
  }
}

export async function exchangeGeeIdAuthorizationCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const body = await $fetch<unknown>(GEE_ID_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    }
  })
  const token = extractAccessToken(body)
  if (!token) {
    throw new Error('Gee ID token response did not include access_token')
  }
  return token
}

export async function fetchGeeIdUserProfile(accessToken: string): Promise<GeeIdProfile> {
  const body = await $fetch<unknown>(GEE_ID_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  const profile = parseGeeIdUserinfo(body)
  if (!profile) {
    throw new Error('Gee ID userinfo response was invalid')
  }
  return profile
}

/** HttpOnly cookie: Gee access token for server-side userinfo refresh (not persisted in users row). */
export const GEE_ID_ACCESS_TOKEN_COOKIE = 'geemc_gee_access'

export type GeeAuthPayload = {
  username: string
  email: string | null
  avatar: string | null
}

/**
 * When the user is linked to Gee ID and we have their access token in a cookie,
 * overlay latest username / email from Gee (avatar still comes from public URL when DB avatar is empty).
 */
export async function mergeGeeUserinfoFromCookie(
  event: H3Event,
  geeIdUserId: string | null | undefined,
  base: GeeAuthPayload
): Promise<GeeAuthPayload> {
  const gid = geeIdUserId?.trim()
  if (!gid) return base
  const token = getCookie(event, GEE_ID_ACCESS_TOKEN_COOKIE)
  if (!token) return base
  try {
    const p = await fetchGeeIdUserProfile(token)
    if (String(p.id) !== gid) return base
    return {
      ...base,
      username: p.username,
      email: p.email
    }
  } catch {
    return base
  }
}
