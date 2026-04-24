<script setup lang="ts">
const { t } = useI18n()
const { formatTime } = useFormatTime()
const router = useRouter()

type LatestReviewItem = {
  id: number
  resourceId: string
  resourceTitle: string
  resourceCategoryKey: string
  userId: number
  userName: string
  userAvatar: string
  rating: number
  content: string
  likes: number
  time: string
}

const page = ref(1)
const pageSize = ref(20)

const { data } = await useAsyncData(
  'resources-latest-reviews',
  () => $fetch<{ items: LatestReviewItem[], total: number, page: number, pageSize: number }>('/api/resources/latest-reviews', {
    query: {
      page: page.value,
      pageSize: pageSize.value
    }
  }),
  { watch: [page, pageSize] }
)

const items = computed(() => data.value?.items ?? [])
const total = computed(() => Number(data.value?.total ?? 0))
</script>

<template>
  <UContainer class="py-6 max-w-4xl">
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">
          {{ t('resources.latest_reviews_title') }}
        </h1>
        <p class="text-sm text-muted">
          {{ t('resources.latest_reviews_desc') }}
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
        v-for="review in items"
        :key="review.id"
        :ui="{ body: '!p-4' }"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-medium">
              <NuxtLink
                :to="`/${review.resourceCategoryKey}/${review.resourceId}`"
                class="hover:underline"
              >
                {{ review.resourceTitle }}
              </NuxtLink>
            </div>
            <div class="mt-2 flex items-center gap-2 text-xs text-muted">
              <UAvatar
                :src="review.userAvatar"
                size="2xs"
              />
              <span>{{ review.userName }}</span>
              <span>·</span>
              <span>{{ formatTime(review.time) }}</span>
            </div>
          </div>
          <UBadge
            color="warning"
            variant="subtle"
          >
            {{ Number(review.rating || 0).toFixed(1) }} / 5
          </UBadge>
        </div>

        <div class="mt-3 text-sm whitespace-pre-wrap break-words">
          {{ review.content }}
        </div>

        <div class="mt-3 flex items-center gap-1 text-xs text-muted">
          <UIcon name="i-lucide-thumbs-up" />
          <span>{{ review.likes }}</span>
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
