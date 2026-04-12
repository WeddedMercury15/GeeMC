import { clearUsernameCollisionStorage } from '~/utils/usernameCollisionBanner'

export interface AuthUser {
  id: number
  username: string
  groups: string[]
  permissions: string[]
  email?: string | null
  avatar?: string | null
}

export function useAuth() {
  const user = useState<AuthUser | null>('geemc:auth-user', () => null)
  const hydrated = useState('geemc:auth-hydrated', () => false)

  const isLoggedIn = computed(() => !!user.value)

  const canPublish = computed(() => {
    const perms = user.value?.permissions
    return Array.isArray(perms) && perms.includes('geemc.publish')
  })

  async function refresh() {
    // Forward Cookie on SSR (plain $fetch to /api/* does not).
    const fetchMe = useRequestFetch()
    const res = await fetchMe<{ user: AuthUser | null }>('/api/auth/me')
    user.value = res.user
    hydrated.value = true
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    clearUsernameCollisionStorage()
  }

  return {
    user,
    hydrated,
    isLoggedIn,
    canPublish,
    refresh,
    logout
  }
}
