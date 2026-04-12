import type { DropdownMenuItem } from '@nuxt/ui'

export const GEEMC_PRIMARY_OPTIONS = [
  { value: 'indigo', color: '#6366f1' },
  { value: 'rose', color: '#f43f5e' },
  { value: 'orange', color: '#f97316' },
  { value: 'green', color: '#10b981' },
  { value: 'violet', color: '#8b5cf6' },
  { value: 'neutral', color: '#737373' },
  { value: 'gray', color: '#6b7280' },
  { value: 'slate', color: '#64748b' },
  { value: 'stone', color: '#78716c' },
  { value: 'zinc', color: '#71717a' }
] as const

export const GEEMC_PRIMARY_COOKIE = 'geemc-primary-color'

export function useGeemcPrimaryTheme() {
  const { t } = useI18n()
  const appConfig = useAppConfig() as { ui: { colors: { primary: string } } }
  const cookie = useCookie<string | null>(GEEMC_PRIMARY_COOKIE, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax'
  })

  const primaryMenuItems = computed<DropdownMenuItem[]>(() =>
    GEEMC_PRIMARY_OPTIONS.map((o) => ({
      label: t(`layout.theme.${o.value}`),
      type: 'checkbox' as const,
      checked: appConfig.ui.colors.primary === o.value,
      slot: 'primary-color',
      swatchColor: o.color,
      onSelect: (e: Event) => {
        e.preventDefault()
        appConfig.ui.colors.primary = o.value
        cookie.value = o.value
      }
    }))
  )

  return { primaryMenuItems }
}
