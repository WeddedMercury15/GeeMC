<script setup lang="ts">
const { t } = useI18n()
const { formatTime } = useFormatTime()
const router = useRouter()

type LatestUpdateItem = {
  id: number
  resourceId: string
  resourceTitle: string
  resourceCategoryKey: string
  title: string
  version: string
  message: string
  time: string
  updateType: string
}

const page = ref(1)
const pageSize = ref(20)

const { data } = await useAsyncData(
  'resources-latest-updates',
  () => $fetch<{ items: LatestUpdateItem[], total: number, page: number, pageSize: number }>('/api/resources/latest-updates', {
    query: {
      page: page.value,
      pageSize: pageSize.value
    }
  }),
  { watch: [page, pageSize] }
)

const items = computed(() => data.value?.items ?? [])
const total = computed(() => Number(data.value?.total ?? 0))

function updateTypeLabel(type: string) {
  if (type === 'release') return t('resources.version_type_release')
  if (type === 'alpha') return t('resources.version_type_alpha')
  if (type === 'beta') return t('resources.version_type_beta')
  return t('resources.update_type_update')
}
</script>

<template>
  <UContainer class="py-6 max-w-4xl">
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">
          {{ t('resources.latest_updates_title') }}
        </h1>
        <p class="text-sm text-muted">
          {{ t('resources.latest_updates_desc') }}
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

    <div class="space-y-3">
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
        </div>
      </UCard>

      <UEmpty
        v-if="items.length === 0"
        :title="t('resources.list_empty_title')"
        :description="t('resources.list_empty_desc')"
      />
    </div>

    <div
      v-if="total > pageSize"
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
