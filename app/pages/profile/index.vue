<script setup lang="ts">
import { nextTick } from 'vue'

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuth()

definePageMeta({
  middleware: 'auth'
})

useHead({
  title: () => t('profile.title')
})

type ProfileResponse = {
  user: {
    id: number
    username: string
    email?: string
    groups: string[]
    permissions: string[]
    createdAt: string
    seniorityDays: number
    avatar?: string | null
  }
}

const { data, status, error, refresh } = useLazyFetch<ProfileResponse>('/api/user/profile', {
  key: 'user-profile'
})

watch(error, (e) => {
  if (e && (e as { statusCode?: number }).statusCode === 401) {
    navigateTo(localePath('/'))
  }
})

const usernameForm = reactive({ username: '' })
const changingUsername = ref(false)
const profileMenuOpen = ref(false)
const usernameModalOpen = ref(false)

watch(
  () => data.value?.user?.username,
  (name) => {
    if (name) usernameForm.username = name
  },
  { immediate: true }
)

function openUsernameModal() {
  profileMenuOpen.value = false
  nextTick(() => {
    usernameModalOpen.value = true
  })
}

watch(
  () => [route.query.edit_username, status.value, data.value?.user] as const,
  () => {
    if (route.query.edit_username !== '1') return
    if (status.value !== 'success' || !data.value?.user) return
    usernameModalOpen.value = true
    void router.replace({
      path: route.path,
      query: { ...route.query, edit_username: undefined }
    })
  },
  { immediate: true }
)

async function changeUsername() {
  changingUsername.value = true
  try {
    await $fetch('/api/user/profile', {
      method: 'PATCH',
      body: {
        action: 'change_username',
        username: usernameForm.username
      }
    })
    toast.add({
      color: 'success',
      title: t('profile.success'),
      description: t('profile.username_changed')
    })
    usernameModalOpen.value = false
    await refresh()
    await auth.refresh()
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'data' in err
        ? (err as { data?: { statusMessage?: string } }).data?.statusMessage
        : undefined
    toast.add({
      color: 'error',
      title: t('common.error'),
      description: msg || t('profile.update_failed')
    })
  } finally {
    changingUsername.value = false
  }
}
</script>

<template>
  <UContainer class="max-w-5xl space-y-6 max-sm:!px-4 max-sm:!py-4 sm:!py-8">
    <h1 class="text-xl font-bold">
      {{ t('profile.title') }}
    </h1>

    <div
      v-if="status === 'pending'"
      class="flex justify-center py-20"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="h-8 w-8 animate-spin text-primary"
      />
    </div>

    <div
      v-else-if="data?.user"
      class="space-y-6"
    >
      <ProfileHeader :user="data.user">
        <template #actions>
          <UPopover
            v-model:open="profileMenuOpen"
            :content="{ align: 'end', side: 'bottom', sideOffset: 8 }"
          >
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              square
              icon="i-lucide-ellipsis"
              :aria-label="t('profile.actions_menu')"
            />
            <template #content>
              <div class="flex min-w-[12rem] flex-col gap-0.5 p-1">
                <UButton
                  color="neutral"
                  variant="ghost"
                  class="justify-start"
                  icon="i-lucide-user"
                  :label="t('profile.change_username')"
                  @click="openUsernameModal"
                />
              </div>
            </template>
          </UPopover>
        </template>
      </ProfileHeader>

      <UModal
        v-model:open="usernameModalOpen"
        :ui="{ content: 'sm:max-w-md' }"
      >
        <template #content>
          <div class="p-6">
            <h3 class="mb-4 text-lg font-semibold text-highlighted">
              {{ t('profile.change_username') }}
            </h3>
            <UForm
              :state="usernameForm"
              class="space-y-4"
              @submit="changeUsername"
            >
              <UFormField
                :label="t('profile.username_label')"
                name="username"
              >
                <UInput
                  v-model="usernameForm.username"
                  class="w-full"
                  autocomplete="username"
                />
              </UFormField>
              <div class="flex justify-end gap-2 pt-2">
                <UButton
                  color="neutral"
                  variant="ghost"
                  @click="usernameModalOpen = false"
                >
                  {{ t('common.cancel') }}
                </UButton>
                <UButton
                  type="submit"
                  :loading="changingUsername"
                >
                  {{ t('common.save') }}
                </UButton>
              </div>
            </UForm>
          </div>
        </template>
      </UModal>
    </div>

    <div
      v-else
      class="flex justify-center py-20"
    >
      <UEmpty :description="t('common.error')" />
    </div>
  </UContainer>
</template>
