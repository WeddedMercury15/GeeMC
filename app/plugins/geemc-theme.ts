export default defineNuxtPlugin(() => {
  const appConfig = useAppConfig() as { ui?: { colors?: { primary?: string } } }
  const c = useCookie<string | null>('geemc-primary-color')
  if (c.value && appConfig.ui?.colors) {
    appConfig.ui.colors.primary = c.value
  }
})
