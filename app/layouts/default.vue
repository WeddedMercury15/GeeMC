<script setup lang="ts">
import {
  SS_USERNAME_DISMISSED,
  SS_USERNAME_HINT,
  oauthCollisionHintReceived
} from '~/utils/usernameCollisionBanner'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const localePath = useLocalePath()
const auth = useAuth()

const showCollisionBanner = ref(false)

function syncBanner() {
  if (!import.meta.client) return
  if (sessionStorage.getItem(SS_USERNAME_DISMISSED) === '1') {
    showCollisionBanner.value = false
    return
  }
  if (sessionStorage.getItem(SS_USERNAME_HINT) === '1' && auth.isLoggedIn.value) {
    showCollisionBanner.value = true
  }
}

function stripSuggestQuery() {
  if (route.query.suggest_username !== '1') return
  if (!import.meta.client) return
  oauthCollisionHintReceived()
  void router.replace({
    path: route.path,
    query: { ...route.query, suggest_username: undefined }
  })
  showCollisionBanner.value = !!auth.isLoggedIn.value
}

function dismissBanner() {
  if (import.meta.client) {
    sessionStorage.setItem(SS_USERNAME_DISMISSED, '1')
    sessionStorage.removeItem(SS_USERNAME_HINT)
  }
  showCollisionBanner.value = false
}

function goEditUsername() {
  dismissBanner()
  void navigateTo({ path: localePath('/profile'), query: { edit_username: '1' } })
}

onMounted(() => {
  stripSuggestQuery()
  syncBanner()
})

watch(
  () => route.query.suggest_username,
  () => {
    stripSuggestQuery()
    syncBanner()
  }
)

watch(
  () => auth.isLoggedIn.value,
  (ok) => {
    if (ok) syncBanner()
    else showCollisionBanner.value = false
  }
)
</script>

<template>
  <GeeNavbar />
  <div
    v-if="showCollisionBanner"
    class="border-b border-primary/25 bg-primary/5"
  >
    <div
      class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
    >
      <p class="min-w-0 text-(--ui-text)">
        <span class="font-medium">{{ t('layout.username_collision_title') }}</span>
        {{ t('layout.username_collision_desc') }}
      </p>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <UButton
          size="sm"
          @click="goEditUsername"
        >
          {{ t('layout.username_collision_edit') }}
        </UButton>
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          @click="dismissBanner"
        >
          {{ t('layout.username_collision_later') }}
        </UButton>
      </div>
    </div>
  </div>
  <UMain>
    <slot />
  </UMain>
  <GeeFooter />
</template>
