import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { deleteCookie, getCookie, getQuery, sendRedirect, setCookie } from 'h3'
import { sessions, users } from '../../../database/schema'
import { SESSION_COOKIE, hashPassword } from '../../../utils/auth'
import { useDb } from '../../../utils/db'
import {
  exchangeGeeIdAuthorizationCode,
  fetchGeeIdUserProfile,
  GEE_ID_ACCESS_TOKEN_COOKIE,
  getGeeIdOAuthClientId,
  getGeeIdOAuthClientSecret,
  getGeeIdOAuthRedirectUri
} from '../../../utils/geeIdOAuth'
import { addUserToGroup, ensureDefaultUserGroups, getGroupIdBySlug } from '../../../utils/userGroupClaims'
import { pickUsernameForFirstGeeMcLogin } from '../../../utils/initialUsernameFromGee'

const STATE_COOKIE = 'geemc_gee_oauth_state'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const err = typeof query.error === 'string' ? query.error : undefined
  if (err) {
    return sendRedirect(event, `/?oauth_error=${encodeURIComponent(err)}`, 302)
  }

  const code = typeof query.code === 'string' ? query.code : ''
  const state = typeof query.state === 'string' ? query.state : ''
  if (!code || !state) {
    return sendRedirect(event, '/?oauth_error=missing', 302)
  }

  const expected = getCookie(event, STATE_COOKIE)
  deleteCookie(event, STATE_COOKIE, { path: '/' })
  if (!expected || expected !== state) {
    return sendRedirect(event, '/?oauth_error=state', 302)
  }

  const clientId = getGeeIdOAuthClientId()
  const clientSecret = getGeeIdOAuthClientSecret()
  if (!clientId || !clientSecret) {
    return sendRedirect(event, '/?oauth_error=config', 302)
  }

  const redirectUri = getGeeIdOAuthRedirectUri(event)

  let accessToken: string
  let profile: Awaited<ReturnType<typeof fetchGeeIdUserProfile>>
  try {
    accessToken = await exchangeGeeIdAuthorizationCode(code, redirectUri, clientId, clientSecret)
    profile = await fetchGeeIdUserProfile(accessToken)
  } catch {
    return sendRedirect(event, '/?oauth_error=token', 302)
  }

  const db = await useDb()
  try {
    await ensureDefaultUserGroups(db)
  } catch {
    return sendRedirect(event, '/?oauth_error=db', 302)
  }

  let userCount = 0
  try {
    const countRows = await db.select({ c: sql<number>`count(*)` }).from(users)
    userCount = Number(countRows[0]?.c ?? 0)
  } catch {
    return sendRedirect(event, '/?oauth_error=db', 302)
  }

  const isFirstUser = userCount === 0
  const externalId = profile.id

  const byGee = await db.select().from(users).where(eq(users.geeIdUserId, externalId)).limit(1)
  let user = byGee[0]

  let postLoginPath = '/'

  if (!user) {
    const now = new Date().toISOString()
    let initialUsername: string
    let hadCollision: boolean
    try {
      const picked = await pickUsernameForFirstGeeMcLogin(db, profile.username, externalId)
      initialUsername = picked.username
      hadCollision = picked.hadCollision
    } catch {
      return sendRedirect(event, '/?oauth_error=create', 302)
    }

    if (hadCollision) {
      postLoginPath = '/?suggest_username=1'
    }

    try {
      await db.insert(users).values({
        username: initialUsername,
        createdAt: now,
        geeIdUserId: externalId
      })
    } catch {
      return sendRedirect(event, '/?oauth_error=create', 302)
    }

    const [created] = await db.select().from(users).where(eq(users.geeIdUserId, externalId)).limit(1)
    if (!created) {
      return sendRedirect(event, '/?oauth_error=create', 302)
    }

    if (isFirstUser) {
      const superGroupId = await getGroupIdBySlug(db, 'super_admin')
      if (superGroupId != null) {
        await addUserToGroup(db, created.id, superGroupId)
      }
    } else {
      const defaultGroupId = await getGroupIdBySlug(db, 'registered_user')
      if (defaultGroupId != null) {
        await addUserToGroup(db, created.id, defaultGroupId)
      }
    }

    user = created
  }

  if (!user) {
    return sendRedirect(event, '/?oauth_error=session', 302)
  }

  const rawToken = randomUUID()
  const now = new Date().toISOString()
  await db.insert(sessions).values({
    id: randomUUID(),
    userId: user.id,
    tokenHash: hashPassword(rawToken),
    createdAt: now,
    expiresAt: new Date(Date.now() + 60 * 60 * 24 * 7 * 1000).toISOString()
  })

  setCookie(event, SESSION_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  })

  setCookie(event, GEE_ID_ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  })

  return sendRedirect(event, postLoginPath, 302)
})
