<script setup lang="ts">
const { t } = useI18n()
const { formatTime } = useFormatTime()
const route = useRoute()
const auth = useAuth()
const toast = useToast()

definePageMeta({
  path: '/resources/:id(\\d+)/reviews'
})

const id = computed(() => String(route.params.id || ''))
const page = ref(1)
const pageSize = ref(20)
const rating = ref<'all' | '1' | '2' | '3' | '4' | '5'>('all')
const order = ref<'rating_date' | 'vote_score' | 'rating'>('rating_date')
const direction = ref<'asc' | 'desc'>('desc')

const { data } = await useAsyncData(
  'resource-reviews-page',
  () => $fetch<{
    resource: { id: string, title: string, categoryKey: string, canReplyAsManager: boolean }
    items: Array<{
      id: number
      userId: number
      userName: string
      userAvatar: string
      rating: number
      content: string
      likes: number
      likedByMe?: boolean
      time: string
      reply?: {
        userId: number
        userName: string
        userAvatar: string
        message: string
        createdAt: string
        updatedAt: string
      }
    }>
    total: number
    page: number
    pageSize: number
    filters: { rating: number | null, order: string, direction: string }
  }>(`/api/resources/${id.value}/reviews/page`, {
    query: {
      page: page.value,
      pageSize: pageSize.value,
      rating: rating.value === 'all' ? undefined : rating.value,
      order: order.value,
      direction: direction.value
    }
  }),
  { watch: [id, page, pageSize, rating, order, direction] }
)

const resource = computed(() => data.value?.resource)
const items = computed(() => data.value?.items ?? [])
const total = computed(() => Number(data.value?.total ?? 0))
const reviewReplyForms = reactive<Record<number, string>>({})

type ReviewPageValidationError = {
  path?: string
  message?: string
}

const ratingItems = computed(() => [
  { label: t('resources.review_filter_rating_all'), value: 'all' },
  { label: '5 ★', value: '5' },
  { label: '4 ★', value: '4' },
  { label: '3 ★', value: '3' },
  { label: '2 ★', value: '2' },
  { label: '1 ★', value: '1' }
])

const orderItems = computed(() => [
  { label: t('resources.review_sort_latest'), value: 'rating_date' },
  { label: t('resources.review_sort_helpful'), value: 'vote_score' },
  { label: t('resources.review_sort_rating'), value: 'rating' }
])

watch([rating, order, direction], () => {
  page.value = 1
})

function getReviewPageErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') return fallback

  const maybeError = error as {
    data?: {
      data?: {
        details?: ReviewPageValidationError[]
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
      reason: t('resources.review_report'),
      message: t('resources.review_reply_submit')
    }
    const path = String(first?.path || '')
    const label = pathMap[path] || ''
    return label ? `${label}: ${first?.message || fallback}` : (first?.message || fallback)
  }

  const statusMessage = maybeError.data?.message || maybeError.data?.statusMessage || maybeError.statusMessage || maybeError.message
  if (!statusMessage) return fallback

  const statusMap: Record<string, string> = {
    'Cannot report your own review': t('resources.error_cannot_report_own_review'),
    'Managers cannot report this review': t('resources.error_managers_cannot_report_review')
  }
  return statusMap[statusMessage] || statusMessage
}

async function reportReview(reviewId: number) {
  if (!auth.isLoggedIn.value) {
    toast.add({ title: t('common.error'), description: t('resources.review_report_login_required'), color: 'error' })
    return
  }
  const reason = window.prompt(t('resources.review_report_prompt'))
  if (!reason || !reason.trim()) return
  if (reason.trim().length > 500) {
    toast.add({ title: t('common.error'), description: t('validation.max_length_label', { label: t('resources.review_report'), max: 500 }), color: 'error' })
    return
  }
  try {
    await $fetch(`/api/resources/${id.value}/reviews/${reviewId}/report`, {
      method: 'POST',
      body: { reason: reason.trim() }
    })
    toast.add({ title: t('common.success'), description: t('resources.review_reported'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: getReviewPageErrorMessage(error, t('resources.review_report_failed')), color: 'error' })
  }
}

async function toggleReviewLike(reviewId: number) {
  if (!auth.isLoggedIn.value) {
    toast.add({ title: t('common.error'), description: t('resources.review_like_login_required'), color: 'error' })
    return
  }
  try {
    await $fetch(`/api/resources/${id.value}/reviews/${reviewId}/like`, { method: 'POST' })
    await refreshNuxtData('resource-reviews-page')
  } catch {
    toast.add({ title: t('common.error'), description: t('resources.review_like_failed'), color: 'error' })
  }
}

async function submitReviewReply(reviewId: number) {
  const message = String(reviewReplyForms[reviewId] ?? '').trim()
  if (!message) {
    toast.add({ title: t('common.error'), description: t('validation.required_label', { label: t('resources.review_reply_submit') }), color: 'error' })
    return
  }
  if (message.length > 5000) {
    toast.add({ title: t('common.error'), description: t('validation.max_length_label', { label: t('resources.review_reply_submit'), max: 5000 }), color: 'error' })
    return
  }
  try {
    await $fetch(`/api/resources/${id.value}/reviews/${reviewId}/reply`, {
      method: 'POST',
      body: { message }
    })
    reviewReplyForms[reviewId] = ''
    await refreshNuxtData('resource-reviews-page')
    toast.add({ title: t('common.success'), description: t('resources.review_reply_saved'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: getReviewPageErrorMessage(error, t('resources.review_reply_save_failed')), color: 'error' })
  }
}

async function deleteReviewReply(reviewId: number) {
  try {
    await $fetch(`/api/resources/${id.value}/reviews/${reviewId}/reply.delete`, { method: 'POST' })
    await refreshNuxtData('resource-reviews-page')
    toast.add({ title: t('common.success'), description: t('resources.review_reply_deleted'), color: 'success' })
  } catch {
    toast.add({ title: t('common.error'), description: t('resources.review_reply_delete_failed'), color: 'error' })
  }
}
</script>

<template>
  <UContainer class="py-6 max-w-4xl">
    <div class="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">
          {{ t('resources.reviews_page_title') }}
        </h1>
        <p class="text-sm text-muted">
          {{ resource?.title }}
        </p>
      </div>
      <UButton
        color="neutral"
        variant="outline"
        :to="`/resources/${id}`"
        icon="i-lucide-arrow-left"
      >
        {{ t('resources.back') }}
      </UButton>
    </div>

    <UCard class="mb-4">
      <div class="grid gap-3 md:grid-cols-3">
        <UFormField :label="t('resources.review_filter_rating')">
          <USelect
            v-model="rating"
            :items="ratingItems"
            option-attribute="label"
            value-attribute="value"
          />
        </UFormField>
        <UFormField :label="t('resources.review_filter_sort')">
          <USelect
            v-model="order"
            :items="orderItems"
            option-attribute="label"
            value-attribute="value"
          />
        </UFormField>
        <UFormField :label="t('resources.review_filter_direction')">
          <USelect
            v-model="direction"
            :items="[
              { label: t('resources.review_direction_desc'), value: 'desc' },
              { label: t('resources.review_direction_asc'), value: 'asc' }
            ]"
            option-attribute="label"
            value-attribute="value"
          />
        </UFormField>
      </div>
    </UCard>

    <UEmpty
      v-if="items.length === 0"
      :title="t('resources.reviews_empty_title')"
      :description="t('resources.reviews_empty_desc')"
    />

    <div
      v-else
      class="space-y-3"
    >
      <UCard
        v-for="r in items"
        :id="`review-${r.id}`"
        :key="r.id"
      >
        <div class="flex items-start gap-3">
          <UAvatar :src="r.userAvatar" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <NuxtLink
                :to="`/resources/${id}/review/${r.id}`"
                class="font-semibold hover:underline"
              >
                {{ r.userName }}
              </NuxtLink>
              <div class="text-xs text-muted">
                {{ formatTime(r.time) }}
              </div>
            </div>
            <div class="mt-2 text-sm whitespace-pre-wrap break-words">
              {{ r.content }}
            </div>
            <div class="mt-2 flex items-center gap-2">
              <UBadge
                color="warning"
                variant="subtle"
              >
                {{ r.rating }} / 5
              </UBadge>
              <span class="text-xs text-muted inline-flex items-center gap-1">
                <UButton
                  size="xs"
                  :color="r.likedByMe ? 'primary' : 'neutral'"
                  :variant="r.likedByMe ? 'soft' : 'ghost'"
                  icon="i-lucide-thumbs-up"
                  @click="toggleReviewLike(r.id)"
                >
                  {{ r.likes }}
                </UButton>
              </span>
              <UButton
                v-if="auth.user.value && Number(auth.user.value.id) !== Number(r.userId)"
                size="xs"
                color="warning"
                variant="ghost"
                icon="i-lucide-flag"
                @click="reportReview(r.id)"
              >
                {{ t('resources.review_report') }}
              </UButton>
            </div>
            <div
              v-if="r.reply"
              class="mt-3 rounded-md border border-(--ui-border) bg-(--ui-bg-elevated)/60 p-3"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="text-xs font-medium">
                  {{ t('resources.review_reply_from', { user: r.reply.userName }) }}
                </div>
                <div class="text-xs text-muted">
                  {{ formatTime(r.reply.updatedAt || r.reply.createdAt) }}
                </div>
              </div>
              <div class="mt-1 text-sm whitespace-pre-wrap break-words">
                {{ r.reply.message }}
              </div>
              <div
                v-if="resource?.canReplyAsManager"
                class="mt-2 flex justify-end"
              >
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-x"
                  @click="deleteReviewReply(r.id)"
                >
                  {{ t('resources.review_reply_delete') }}
                </UButton>
              </div>
            </div>
            <div
              v-if="resource?.canReplyAsManager"
              class="mt-3 space-y-2"
            >
              <UTextarea
                v-model="reviewReplyForms[r.id]"
                :rows="2"
                :placeholder="t('resources.review_reply_placeholder')"
              />
              <div class="flex justify-end">
                <UButton
                  size="xs"
                  color="primary"
                  :disabled="!String(reviewReplyForms[r.id] ?? '').trim()"
                  @click="submitReviewReply(r.id)"
                >
                  {{ r.reply ? t('resources.review_reply_update') : t('resources.review_reply_submit') }}
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </UCard>
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
