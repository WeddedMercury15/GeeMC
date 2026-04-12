import { randomBytes } from 'node:crypto'
import { sendRedirect, setCookie } from 'h3'
import {
  GEE_ID_AUTHORIZE_URL,
  getGeeIdOAuthClientId,
  getGeeIdOAuthClientSecret,
  getGeeIdOAuthRedirectUri
} from '../../../utils/geeIdOAuth'

const STATE_COOKIE = 'geemc_gee_oauth_state'

export default defineEventHandler(async (event) => {
  const clientId = getGeeIdOAuthClientId()
  const clientSecret = getGeeIdOAuthClientSecret()
  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 503, statusMessage: 'Gee ID OAuth is not configured' })
  }

  const redirectUri = getGeeIdOAuthRedirectUri(event)
  const state = randomBytes(24).toString('hex')

  setCookie(event, STATE_COOKIE, state, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    secure: process.env.NODE_ENV === 'production'
  })

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    state
  })

  return sendRedirect(event, `${GEE_ID_AUTHORIZE_URL}?${params.toString()}`, 302)
})
