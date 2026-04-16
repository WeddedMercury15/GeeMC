<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { AuthUser } from '~/composables/useAuth'
import { GEEMC_PRIMARY_OPTIONS } from '~/composables/useGeemcPrimaryTheme'

const { primaryMenuItems } = useGeemcPrimaryTheme()
const appConfig = useAppConfig() as { ui: { colors: { primary: string } } }

const currentPrimarySwatch = computed(() =>
  GEEMC_PRIMARY_OPTIONS.find((o) => o.value === appConfig.ui.colors.primary)?.color ?? '#737373'
)

const auth = useAuth()
const { t, locale, locales, setLocale } = useI18n()
const localePath = useLocalePath()
const toast = useToast()
const colorMode = useColorMode()

const { data: meData } = await useFetch<{ user: AuthUser | null }>('/api/auth/me', { key: 'auth-me-navbar' })

const user = computed(() => meData.value?.user ?? auth.user.value ?? null)

const canAdmin = computed(() => user.value?.permissions?.includes('geemc.admin') ?? false)

const isLogoutModalOpen = ref(false)
const isLoggingOut = ref(false)

type LocaleEntry = { code: string, name?: string }

function startGeeIdLogin() {
  void navigateTo('/api/auth/geeid/start', { external: true })
}

async function handleLogout() {
  isLoggingOut.value = true
  try {
    await auth.logout()
    toast.add({
      title: t('nav.logout_toast'),
      color: 'neutral'
    })
    isLogoutModalOpen.value = false
    await navigateTo(localePath('/'))
  } finally {
    isLoggingOut.value = false
  }
}

const localeSubItems = computed<DropdownMenuItem[]>(() =>
  (locales.value as LocaleEntry[]).map((l) => ({
    label: l.name ?? l.code,
    type: 'checkbox' as const,
    checked: locale.value === l.code,
    onSelect: (e: Event) => {
      e.preventDefault()
      void setLocale(l.code as 'en-US' | 'zh-CN')
    }
  }))
)

const themeSubItems = computed<DropdownMenuItem[]>(() => [
  {
    label: t('layout.appearance.system'),
    icon: 'i-lucide-monitor',
    type: 'checkbox',
    checked: colorMode.preference === 'system',
    onSelect: (e: Event) => {
      e.preventDefault()
      colorMode.preference = 'system'
    }
  },
  {
    label: t('layout.appearance.light'),
    icon: 'i-lucide-sun',
    type: 'checkbox',
    checked: colorMode.preference === 'light',
    onSelect: (e: Event) => {
      e.preventDefault()
      colorMode.preference = 'light'
    }
  },
  {
    label: t('layout.appearance.dark'),
    icon: 'i-lucide-moon',
    type: 'checkbox',
    checked: colorMode.preference === 'dark',
    onSelect: (e: Event) => {
      e.preventDefault()
      colorMode.preference = 'dark'
    }
  }
])

const localeAndAppearanceRow = computed<DropdownMenuItem[]>(() => [
  {
    label: t('common.locale.switch'),
    icon: 'i-lucide-languages',
    children: localeSubItems.value
  },
  {
    label: t('layout.user.appearance'),
    icon: 'i-lucide-sun-moon',
    children: themeSubItems.value
  },
  {
    label: t('layout.user.theme_color'),
    icon: 'i-lucide-palette',
    slot: 'theme-color-parent',
    children: primaryMenuItems.value,
    content: {
      class: 'min-w-[140px] max-h-[min(350px,70vh)]'
    }
  }
])

const guestMenuItems = computed<DropdownMenuItem[][]>(() => [
  localeAndAppearanceRow.value
])

const userMenuItems = computed<DropdownMenuItem[][]>(() => {
  const u = user.value
  if (!u) return []

  return [
    [
      {
        label: u.username,
        slot: 'account',
        disabled: true
      }
    ],
    [
      {
        label: t('layout.nav.profile'),
        icon: 'i-lucide-user',
        to: localePath('/profile')
      },
      ...(canAdmin.value
        ? [
            {
              label: t('admin.panel_title'),
              icon: 'i-lucide-layout-dashboard',
              to: localePath('/admin')
            }
          ]
        : [])
    ],
    localeAndAppearanceRow.value,
    [
      {
        label: t('layout.user.logout'),
        icon: 'i-lucide-log-out',
        color: 'error' as const,
        onSelect: () => {
          isLogoutModalOpen.value = true
        }
      }
    ]
  ]
})
</script>

<template>
  <div class="flex items-center gap-0.5">
    <UDropdownMenu
      v-if="!user"
      :items="guestMenuItems"
      :content="{
        align: 'end',
        sideOffset: 8
      }"
      :ui="{ item: 'cursor-pointer items-center' }"
    >
      <template #primary-color-leading="{ item }">
        <span
          class="flex size-5 shrink-0 items-center justify-center self-center"
          aria-hidden="true"
        >
          <span
            class="size-2 shrink-0 rounded-full"
            :style="{ backgroundColor: (item as { swatchColor?: string }).swatchColor }"
          />
        </span>
      </template>
      <template #theme-color-parent-trailing="{ item, active, ui }">
        <span class="inline-flex items-center gap-1.5">
          <span
            class="size-2 shrink-0 rounded-full"
            :style="{ backgroundColor: currentPrimarySwatch }"
            aria-hidden="true"
          />
          <UIcon
            name="i-lucide-chevron-right"
            :class="ui.itemTrailingIcon({
              class: (item as DropdownMenuItem).ui?.itemTrailingIcon,
              color: (item as DropdownMenuItem).color,
              active
            })"
          />
        </span>
      </template>
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-settings"
        :aria-label="t('layout.nav.settings')"
      />
    </UDropdownMenu>

    <UButton
      v-if="!user"
      variant="ghost"
      color="neutral"
      icon="i-lucide-log-in"
      :aria-label="t('auth.login_with_gee_id')"
      @click="startGeeIdLogin"
    />

    <UDropdownMenu
      v-else
      :items="userMenuItems"
      :content="{
        align: 'end',
        sideOffset: 8
      }"
      :ui="{ item: 'cursor-pointer items-center' }"
    >
      <template #primary-color-leading="{ item }">
        <span
          class="flex size-5 shrink-0 items-center justify-center self-center"
          aria-hidden="true"
        >
          <span
            class="size-2 shrink-0 rounded-full"
            :style="{ backgroundColor: (item as { swatchColor?: string }).swatchColor }"
          />
        </span>
      </template>
      <template #theme-color-parent-trailing="{ item, active, ui }">
        <span class="inline-flex items-center gap-1.5">
          <span
            class="size-2 shrink-0 rounded-full"
            :style="{ backgroundColor: currentPrimarySwatch }"
            aria-hidden="true"
          />
          <UIcon
            name="i-lucide-chevron-right"
            :class="ui.itemTrailingIcon({
              class: (item as DropdownMenuItem).ui?.itemTrailingIcon,
              color: (item as DropdownMenuItem).color,
              active
            })"
          />
        </span>
      </template>
      <UButton
        variant="ghost"
        color="neutral"
        class="rounded-full p-0"
      >
        <UserAvatar
          :user="{ username: user.username, avatar: user.avatar }"
          size="sm"
        />
      </UButton>

      <template #account>
        <div class="flex items-center gap-2 p-1 text-left">
          <UserAvatar
            :user="{ username: user.username, avatar: user.avatar }"
            size="md"
          />
          <div class="min-w-0 truncate">
            <p class="truncate font-medium text-(--ui-text-highlighted)">
              {{ user.username }}
            </p>
            <p class="truncate text-xs text-(--ui-text-muted)">
              {{ user.email || t('layout.nav.profile') }}
            </p>
          </div>
        </div>
      </template>
    </UDropdownMenu>
  </div>

  <UModal
    v-model:open="isLogoutModalOpen"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #content>
      <div class="p-6">
        <div class="flex items-start gap-4">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error/10">
            <UIcon
              name="i-lucide-triangle-alert"
              class="h-6 w-6 text-error"
            />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="mb-1 text-lg font-semibold leading-6 text-highlighted">
              {{ t('layout.user.logout') }}
            </h3>
            <p class="text-sm text-(--ui-text-muted)">
              {{ t('auth.logout_confirm') }}
            </p>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <UButton
            color="neutral"
            variant="ghost"
            @click="isLogoutModalOpen = false"
          >
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            color="error"
            :loading="isLoggingOut"
            @click="handleLogout"
          >
            {{ t('common.confirm') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
