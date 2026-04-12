import { getCurrentUser } from '../../utils/auth'
import { useDb } from '../../utils/db'
import { formatAuthUserForClient } from '../../utils/userGroupClaims'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user) {
    return { user: null }
  }
  const db = await useDb()
  const userPayload = await formatAuthUserForClient(db, user, event)
  return { user: userPayload }
})
