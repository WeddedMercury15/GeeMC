<script setup lang="ts">
const { t } = useI18n()
const { formatTime } = useFormatTime()
const router = useRouter()
const auth = useAuth()
const toast = useToast()

type WatchedUpdateItem = {
  id: number
  resourceId: string
  resourceTitle: string
  resourceCategoryKey: string
  title: string
  version: string
  message: string
  time: string
  updateType: string
  isNew?: boolean
}

const page = ref(1)
const pageSize = ref(20)
const timeWindow = ref<'all' | '24h' | '7d' | '30d'>('all')
const unreadOnly = ref(false)
const markingRead = ref(false)

type WatchedUpdatesValidationError = {
  path?: string
  message?: string
}

const windowItems = computed(() => [
  { label: t('resources.watched_updates_window_all'), value: 'all' as const },
  { label: t('resources.watched_updates_window_24h'), value: '24h' as const },
  { label: t('resources.watched_updates_window_7d'), value: '7d' as const },
  { label: t('resources.watched_updates_window_30d'), value: '30d' as const }
])

const { data } = await useAsyncData(
  'resources-watched-updates',
  async () => {
    if (!auth.isLoggedIn.value) {
      return {
        items: [],
        total: 0,
        page: page.value,
        pageSize: pageSize.value,
        window: timeWindow.value,
        unreadOnly: unreadOnly.value,
        unreadTotal: 0
      }
    }
    return await $fetch<{ items: WatchedUpdateItem[], total: number, page: number, pageSize: number, window: string, unreadOnly: boolean, unreadTotal: number }>('/api/resources/watched-updates', {
      query: {
        page: page.value,
        pageSize: pageSize.value,
        window: timeWindow.value,
        unread: unreadOnly.value ? '1' : undefined
      }
    })
  },
  { watch: [page, pageSize, timeWindow, unreadOnly, () => auth.isLoggedIn.value] }
)

const items = computed(() => data.value?.items ?? [])
const total = computed(() => Number(data.value?.total ?? 0))
const unreadTotal = computed(() => Number(data.value?.unreadTotal ?? 0))

watch(timeWindow, () => {
  page.value = 1
})
watch(unreadOnly, () => {
  page.value = 1
})

function getWatchedUpdatesErrorMessage(error: unknown) {
  const fallback = t('resources.watched_updates_mark_read_failed')
  if (!error || typeof error !== 'object') return fallback

  const maybeError = error as {
    data?: {
      data?: {
        details?: WatchedUpdatesValidationError[]
      }
      message?: string
      statusMessage?: string
    }
    message?: string
    statusMessage?: string
  }

  const details = maybeError.data?.data?.details
  if (Array.isArray(details) && details.length > 0) {
    const first = details[0]
    const pathMap: Record<string, string> = {
      updateId: t('resources.update_title')
    }
    const label = first?.path ? pathMap[first.path] : ''
    return label ? `${label}: ${first?.message || fallback}` : (first?.message || fallback)
  }

  return maybeError.data?.message || maybeError.data?.statusMessage || maybeError.statusMessage || maybeError.message || fallback
}

async function markAllRead() {
  if (!auth.isLoggedIn.value) return
  markingRead.value = true
  try {
    await $fetch('/api/resources/watched-updates/read-all', { method: 'POST' })
    await refreshNuxtData('resources-watched-updates')
    toast.add({ title: t('common.success'), description: t('resources.watched_updates_mark_read_done'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: getWatchedUpdatesErrorMessage(error), color: 'error' })
  } finally {
    markingRead.value = false
  }
}

async function markResourceRead(updateId: number) {
  if (!auth.isLoggedIn.value) return
  try {
    await $fetch('/api/resources/watched-updates/read-resource', {
      method: 'POST',
      body: { updateId }
    })
    await refreshNuxtData('resources-watched-updates')
  } catch (error) {
    toast.add({ title: t('common.error'), description: getWatchedUpdatesErrorMessage(error), color: 'error' })
  }
}

function updateTypeLabel(type: string) {
  if (type === 'release') return t('resources.version_type_release')
  if (type === 'snapshot') return t('resources.version_type_snapshot')
  return t('resources.update_type_update')
}
</script>

<template>
  <UContainer class="py-6 max-w-4xl">
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">
          {{ t('resources.watched_updates_title') }}
        </h1>
        <p class="text-sm text-muted">
          {{ t('resources.watched_updates_desc') }}
        </p>
      </div>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-arrow-left"
        @click="router.push('/resources')"
      >
        {{ t('resources.back_to_list') }}
      </UButton>
    </div>

    <UEmpty
      v-if="!auth.isLoggedIn.value"
      :title="t('common.error')"
      :description="t('resources.watched_updates_login_required')"
    />

    <div
      v-else
      class="space-y-3"
    >
      <div class="flex items-center gap-2">
        <UBadge
          color="warning"
          variant="subtle"
        >
          {{ t('resources.watched_updates_unread_total', { total: unreadTotal }) }}
        </UBadge>
        <span class="text-sm text-muted">{{ t('resources.watched_updates_window_label') }}</span>
        <USelect
          v-model="timeWindow"
          :items="windowItems"
          option-attribute="label"
          value-attribute="value"
          class="w-44"
          size="sm"
        />
        <UCheckbox v-model="unreadOnly" />
        <span class="text-sm text-muted">{{ t('resources.watched_updates_unread_only') }}</span>
        <UButton
          size="sm"
          color="neutral"
          variant="outline"
          :loading="markingRead"
          @click="markAllRead"
        >
          {{ t('resources.watched_updates_mark_read') }}
        </UButton>
      </div>
      <UCard
        v-for="log in items"
        :key="log.id"
        :ui="{ body: '!p-4' }"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-medium">
              <NuxtLink
                :to="`/resources/${log.resourceId}`"
                class="hover:underline"
              >
                {{ log.resourceTitle }}
              </NuxtLink>
            </div>
            <div class="mt-1 text-xs text-muted">
              {{ formatTime(log.time) }}
            </div>
          </div>
          <UBadge
            color="primary"
            variant="subtle"
          >
            {{ updateTypeLabel(log.updateType) }}
          </UBadge>
          <UBadge
            v-if="log.isNew"
            color="warning"
            variant="subtle"
          >
            {{ t('resources.watched_updates_new') }}
          </UBadge>
        </div>

        <div class="mt-3 flex items-center gap-2 text-sm">
          <UBadge
            v-if="log.version"
            color="neutral"
            variant="outline"
          >
            {{ log.version }}
          </UBadge>
          <span class="font-medium">{{ log.title || t('resources.update_type_update') }}</span>
        </div>

        <div class="mt-2 text-sm whitespace-pre-wrap break-words line-clamp-4">
          {{ log.message }}
        </div>

        <div class="mt-3">
          <UButton
            size="xs"
            color="neutral"
            variant="outline"
            icon="i-lucide-link"
            :to="`/updates/${log.id}`"
          >
            {{ t('resources.open_update_permalink') }}
          </UButton>
          <UButton
            v-if="log.isNew"
            size="xs"
            color="neutral"
            variant="ghost"
            class="ml-2"
            icon="i-lucide-check"
            @click="markResourceRead(log.id)"
          >
            {{ t('resources.watched_updates_mark_item_read') }}
          </UButton>
        </div>
      </UCard>

      <UEmpty
        v-if="items.length === 0"
        :title="t('resources.list_empty_title')"
        :description="t('resources.list_empty_desc')"
      />
    </div>

    <div
      v-if="auth.isLoggedIn.value && total > pageSize"
      class="mt-5 flex justify-center"
    >
      <UPagination
        v-model:page="page"
        :total="total"
        :page-count="pageSize"
      />
    </div>
  </UContainer>
</template>
