import type { H3Event } from 'h3'
import { getCurrentUser } from './auth'
import { useDb } from './db'
import { resolveUserGroupClaims } from './userGroupClaims'

export async function requireGeemcAdmin(event: H3Event) {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const db = await useDb()
  const { permissions } = await resolveUserGroupClaims(db, user.id)
  if (!permissions.includes('geemc.admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return user
}
