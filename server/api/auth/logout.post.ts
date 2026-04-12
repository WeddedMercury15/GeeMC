import { deleteCookie, getCookie } from 'h3'
import { eq } from 'drizzle-orm'
import { hashPassword, SESSION_COOKIE } from '../../utils/auth'
import { GEE_ID_ACCESS_TOKEN_COOKIE } from '../../utils/geeIdOAuth'
import { sessions } from '../../database/schema'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, SESSION_COOKIE)
  if (token) {
    const db = await useDb()
    await db.delete(sessions).where(eq(sessions.tokenHash, hashPassword(token)))
  }
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
  deleteCookie(event, GEE_ID_ACCESS_TOKEN_COOKIE, { path: '/' })
  return { success: true }
})
