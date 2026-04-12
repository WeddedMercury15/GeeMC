export default defineNuxtPlugin(async () => {
  const auth = useAuth()
  try {
    await auth.refresh()
  } catch {
    auth.hydrated.value = true
  }
})
