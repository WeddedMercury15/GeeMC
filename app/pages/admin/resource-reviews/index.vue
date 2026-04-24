<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()

type ReviewItem = {
  id: number
  resourceId: string
  resourceTitle: string
  categoryKey: string
  userId: number
  userName: string
  rating: number
  content: string
  likes: number
  reviewState: 'visible' | 'deleted' | string
  time: string
}

const keyword = ref('')
const ratingMin = ref(1)
const ratingMax = ref(5)
const state = ref<'all' | 'visible' | 'deleted'>('all')
const from = ref('')
const to = ref('')
const page = ref(1)
const pageSize = ref(20)
const selectedIds = ref<number[]>([])
const submitting = ref(false)

const { data, pending, refresh } = await useAsyncData(
  'admin-resource-reviews-page',
  () => $fetch<{ items: ReviewItem[], total: number, page: number, pageSize: number }>('/api/admin/resource-reviews/page', {
    query: {
      keyword: keyword.value || undefined,
      ratingMin: ratingMin.value,
      ratingMax: ratingMax.value,
      state: state.value === 'all' ? undefined : state.value,
      from: from.value || undefined,
      to: to.value || undefined,
      page: page.value,
      pageSize: pageSize.value
    }
  }),
  { watch: [keyword, ratingMin, ratingMax, state, from, to, page, pageSize] }
)

const items = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

function setSelected(id: number, checked: boolean | 'indeterminate') {
  if (checked === 'indeterminate') return
  if (checked && !selectedIds.value.includes(id)) {
    selectedIds.value = [...selectedIds.value, id]
    return
  }
  selectedIds.value = selectedIds.value.filter(x => x !== id)
}

async function applyIntent(intent: 'delete' | 'restore', ids?: number[]) {
  const targetIds = ids && ids.length > 0 ? ids : selectedIds.value
  if (targetIds.length === 0) return
  submitting.value = true
  try {
    const res = await $fetch<{ success: boolean, changed: number }>('/api/admin/resource-reviews/manage', {
      method: 'POST',
      body: { ids: targetIds, intent }
    })
    selectedIds.value = selectedIds.value.filter(id => !targetIds.includes(id))
    await refresh()
    toast.add({
      title: t('common.success'),
      description: intent === 'delete'
        ? t('admin.resource_reviews_page.delete_success', { count: res.changed })
        : t('admin.resource_reviews_page.restore_success', { count: res.changed }),
      color: 'success'
    })
  } catch {
    toast.add({
      title: t('common.error'),
      description: intent === 'delete' ? t('admin.resource_reviews_page.delete_failed') : t('admin.resource_reviews_page.restore_failed'),
      color: 'error'
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-3xl font-bold tracking-tight">
        {{ t('admin.resource_reviews_page.title') }}
      </h2>
      <p class="text-(--ui-text-muted)">
        {{ t('admin.resource_reviews_page.subtitle') }}
      </p>
    </div>

    <div class="flex items-center gap-2">
      <UInput
        v-model="keyword"
        icon="i-lucide-search"
        :placeholder="t('admin.resource_reviews_page.search_placeholder')"
      />
      <USelect
        v-model="ratingMin"
        :items="[{ label: '>= 1', value: 1 }, { label: '>= 2', value: 2 }, { label: '>= 3', value: 3 }, { label: '>= 4', value: 4 }, { label: '>= 5', value: 5 }]"
        option-attribute="label"
        value-attribute="value"
      />
      <USelect
        v-model="ratingMax"
        :items="[{ label: '<= 1', value: 1 }, { label: '<= 2', value: 2 }, { label: '<= 3', value: 3 }, { label: '<= 4', value: 4 }, { label: '<= 5', value: 5 }]"
        option-attribute="label"
        value-attribute="value"
      />
      <USelect
        v-model="state"
        :items="[
          { label: t('admin.resource_reviews_page.state_all'), value: 'all' },
          { label: t('admin.resource_reviews_page.state_visible'), value: 'visible' },
          { label: t('admin.resource_reviews_page.state_deleted'), value: 'deleted' }
        ]"
        option-attribute="label"
        value-attribute="value"
      />
      <UInput
        v-model="from"
        type="datetime-local"
        :placeholder="t('admin.resource_reviews_page.from_placeholder')"
      />
      <UInput
        v-model="to"
        type="datetime-local"
        :placeholder="t('admin.resource_reviews_page.to_placeholder')"
      />
      <UButton
        color="error"
        variant="outline"
        :disabled="selectedIds.length === 0 || submitting"
        @click="applyIntent('delete')"
      >
        {{ t('admin.resource_reviews_page.delete_selected') }}
      </UButton>
      <UButton
        color="success"
        variant="outline"
        :disabled="selectedIds.length === 0 || submitting"
        @click="applyIntent('restore')"
      >
        {{ t('admin.resource_reviews_page.restore_selected') }}
      </UButton>
    </div>

    <div class="flex items-center justify-between text-sm text-(--ui-text-muted)">
      <div>{{ t('admin.resource_reviews_page.total', { total }) }}</div>
      <div class="flex items-center gap-2">
        <USelect
          v-model="pageSize"
          :items="[{ label: '20', value: 20 }, { label: '50', value: 50 }, { label: '100', value: 100 }]"
          option-attribute="label"
          value-attribute="value"
        />
        <UButton
          size="xs"
          color="neutral"
          variant="outline"
          :disabled="page <= 1"
          @click="page = page - 1"
        >
          {{ t('admin.resource_reviews_page.prev_page') }}
        </UButton>
        <span>{{ page }} / {{ totalPages }}</span>
        <UButton
          size="xs"
          color="neutral"
          variant="outline"
          :disabled="page >= totalPages"
          @click="page = page + 1"
        >
          {{ t('admin.resource_reviews_page.next_page') }}
        </UButton>
      </div>
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-(--ui-border) bg-(--ui-bg-elevated)/50 text-(--ui-text-muted)">
            <tr>
              <th class="px-3 py-3">
                <UCheckbox />
              </th>
              <th class="px-4 py-3 font-medium">
                {{ t('admin.resource_reviews_page.col_resource') }}
              </th>
              <th class="px-4 py-3 font-medium">
                {{ t('admin.resource_reviews_page.col_user') }}
              </th>
              <th class="px-4 py-3 font-medium">
                {{ t('admin.resource_reviews_page.col_rating') }}
              </th>
              <th class="px-4 py-3 font-medium">
                {{ t('admin.resource_reviews_page.col_content') }}
              </th>
              <th class="px-4 py-3 font-medium">
                {{ t('admin.resource_reviews_page.col_time') }}
              </th>
              <th class="px-4 py-3 font-medium">
                {{ t('admin.resource_reviews_page.col_state') }}
              </th>
              <th class="px-4 py-3 font-medium text-right">
                {{ t('common.actions') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending">
              <td
                colspan="8"
                class="px-4 py-8 text-center text-(--ui-text-muted)"
              >
                {{ t('admin.resource_reviews_page.loading') }}
              </td>
            </tr>
            <tr v-else-if="items.length === 0">
              <td
                colspan="8"
                class="px-4 py-8 text-center text-(--ui-text-muted)"
              >
                {{ t('admin.resource_reviews_page.empty') }}
              </td>
            </tr>
            <tr
              v-for="row in items"
              :key="row.id"
              class="border-b border-(--ui-border) last:border-0"
            >
              <td class="px-3 py-3">
                <UCheckbox
                  :model-value="selectedIds.includes(row.id)"
                  @update:model-value="(v) => setSelected(row.id, v)"
                />
              </td>
              <td class="px-4 py-3">
                <NuxtLink
                  :to="`/${row.categoryKey}/${row.resourceId}`"
                  class="font-medium text-(--ui-primary) hover:underline"
                >
                  {{ row.resourceTitle }}
                </NuxtLink>
                <div class="text-xs text-(--ui-text-muted)">
                  {{ row.resourceId }}
                </div>
              </td>
              <td class="px-4 py-3">
                {{ row.userName }}
              </td>
              <td class="px-4 py-3">
                {{ row.rating }} / 5
              </td>
              <td class="px-4 py-3">
                <div class="line-clamp-2">
                  {{ row.content }}
                </div>
                <div class="text-xs text-(--ui-text-muted)">
                  👍 {{ row.likes }}
                </div>
              </td>
              <td class="px-4 py-3">
                {{ row.time }}
              </td>
              <td class="px-4 py-3">
                <UBadge
                  :color="row.reviewState === 'deleted' ? 'error' : 'success'"
                  variant="subtle"
                >
                  {{ row.reviewState === 'deleted' ? t('admin.resource_reviews_page.state_deleted') : t('admin.resource_reviews_page.state_visible') }}
                </UBadge>
              </td>
              <td class="px-4 py-3">
                <div class="flex justify-end">
                  <UButton
                    v-if="row.reviewState !== 'deleted'"
                    size="xs"
                    color="error"
                    variant="outline"
                    @click="applyIntent('delete', [row.id])"
                  >
                    {{ t('admin.resource_reviews_page.delete') }}
                  </UButton>
                  <UButton
                    v-else
                    size="xs"
                    color="success"
                    variant="outline"
                    @click="applyIntent('restore', [row.id])"
                  >
                    {{ t('admin.resource_reviews_page.restore') }}
                  </UButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>
