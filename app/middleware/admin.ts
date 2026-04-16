export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuth()
  if (!auth.hydrated.value) {
    try {
      await auth.refresh()
    } catch {
      auth.hydrated.value = true
    }
  }
  if (!auth.isLoggedIn.value) {
    return navigateTo('/api/auth/geeid/start', { external: true })
  }
  const perms = auth.user.value?.permissions ?? []
  if (!perms.includes('geemc.admin')) {
    return navigateTo('/')
  }
})
