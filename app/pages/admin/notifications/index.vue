<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: 'admin',
  ssr: false
})

const { t } = useI18n()
const page = ref(1)
const pageSize = ref(20)
const unreadOnly = ref(false)
const typeFilter = ref('all')
const selectedIds = ref<number[]>([])
const submitting = ref(false)
const deletingReviewId = ref<number | null>(null)
const deletingUpdateId = ref<number | null>(null)
const toast = useToast()

type NotificationManageValidationError = {
  path?: string
  message?: string
}

const typeItems = computed(() => [
  { label: t('notifications.type_all'), value: 'all' },
  { label: t('notifications.type_resource_update'), value: 'resource_update' },
  { label: t('notifications.type_resource_version'), value: 'resource_version' },
  { label: t('notifications.type_resource_description'), value: 'resource_description' },
  { label: t('notifications.type_resource_review_report'), value: 'resource_review_report' },
  { label: t('notifications.type_resource_update_report'), value: 'resource_update_report' },
  { label: t('notifications.type_resource_version_report'), value: 'resource_version_report' }
])

const { data, pending } = await useAsyncData(
  'admin-notifications-page',
  () => $fetch<{
    items: Array<{
      id: number
      userId: number
      userName: string
      type: string
      title: string
      message: string
      messageText: string
      resourceId: string | null
      target?: { tab?: string, anchor?: string } | null
      targetUrl?: string | null
      readAt: string
      createdAt: string
    }>
    total: number
    page: number
    pageSize: number
  }>('/api/admin/notifications/page', {
    query: {
      page: page.value,
      pageSize: pageSize.value,
      unread: unreadOnly.value ? '1' : undefined,
      type: typeFilter.value === 'all' ? undefined : typeFilter.value
    }
  }),
  { watch: [page, pageSize, unreadOnly, typeFilter] }
)

const items = computed(() => data.value?.items ?? [])
const total = computed(() => Number(data.value?.total ?? 0))
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

function exportCsv() {
  const query = new URLSearchParams()
  if (unreadOnly.value) query.set('unread', '1')
  if (typeFilter.value !== 'all') query.set('type', typeFilter.value)
  const url = `/api/admin/notifications/export${query.toString() ? `?${query.toString()}` : ''}`
  void navigateTo(url, { external: true })
}

function setSelected(id: number, checked: boolean | 'indeterminate') {
  if (checked === 'indeterminate') return
  if (checked) {
    if (!selectedIds.value.includes(id)) selectedIds.value = [...selectedIds.value, id]
    return
  }
  selectedIds.value = selectedIds.value.filter(x => x !== id)
}

function getActionErrorMessage(error: unknown) {
  const fallback = t('admin.notifications_page.action_failed')
  if (!error || typeof error !== 'object') return fallback

  const maybeError = error as {
    data?: {
      data?: {
        details?: NotificationManageValidationError[]
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
      ids: t('admin.notifications_page.field_notifications'),
      action: t('admin.notifications_page.field_action')
    }
    const path = String(first?.path || '')
    const label = pathMap[path] || Object.entries(pathMap).find(([key]) => path === key || path.startsWith(`${key}.`))?.[1] || ''
    return label ? `${label}: ${first?.message || fallback}` : (first?.message || fallback)
  }

  return maybeError.data?.message || maybeError.data?.statusMessage || maybeError.statusMessage || maybeError.message || fallback
}

async function applyAction(action: 'read' | 'unread' | 'delete', ids?: number[]) {
  const targetIds = ids && ids.length > 0 ? ids : selectedIds.value
  if (targetIds.length === 0) return
  submitting.value = true
  try {
    await $fetch('/api/admin/notifications/manage', {
      method: 'POST',
      body: { ids: targetIds, action }
    })
    selectedIds.value = selectedIds.value.filter(id => !targetIds.includes(id))
    await refreshNuxtData('admin-notifications-page')
  } catch (error) {
    toast.add({ title: t('common.error'), description: getActionErrorMessage(error), color: 'error' })
  } finally {
    submitting.value = false
  }
}

function extractReviewIdFromNotification(row: { target?: { anchor?: string } | null }) {
  const anchor = row.target?.anchor
  if (!anchor || !anchor.startsWith('review-')) return null
  const id = Number(anchor.slice('review-'.length))
  if (!Number.isFinite(id) || id <= 0) return null
  return id
}

function extractUpdateIdFromNotification(row: { target?: { anchor?: string } | null }) {
  const anchor = row.target?.anchor
  if (!anchor || !anchor.startsWith('update-')) return null
  const id = Number(anchor.slice('update-'.length))
  if (!Number.isFinite(id) || id <= 0) return null
  return id
}

async function deleteReportedReview(row: {
  id: number
  type: string
  resourceId: string | null
  target?: { anchor?: string } | null
}) {
  const reviewId = extractReviewIdFromNotification(row)
  if (row.type !== 'resource_review_report' || !row.resourceId || !reviewId) return
  deletingReviewId.value = row.id
  try {
    await $fetch(`/api/resources/${row.resourceId}/reviews/${reviewId}/delete`, { method: 'POST' })
    await applyAction('read', [row.id])
    toast.add({ title: t('common.success'), description: t('admin.notifications_page.review_deleted'), color: 'success' })
    await refreshNuxtData('admin-notifications-page')
  } catch {
    toast.add({ title: t('common.error'), description: t('admin.notifications_page.review_delete_failed'), color: 'error' })
  } finally {
    deletingReviewId.value = null
  }
}

async function deleteReportedUpdate(row: {
  id: number
  type: string
  resourceId: string | null
  target?: { anchor?: string } | null
}) {
  const updateId = extractUpdateIdFromNotification(row)
  if (row.type !== 'resource_update_report' || !row.resourceId || !updateId) return
  deletingUpdateId.value = row.id
  try {
    await $fetch(`/api/resources/${row.resourceId}/updates/${updateId}/delete`, { method: 'POST' })
    await applyAction('read', [row.id])
    toast.add({ title: t('common.success'), description: t('admin.notifications_page.update_deleted'), color: 'success' })
    await refreshNuxtData('admin-notifications-page')
  } catch {
    toast.add({ title: t('common.error'), description: t('admin.notifications_page.update_delete_failed'), color: 'error' })
  } finally {
    deletingUpdateId.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-3xl font-bold tracking-tight">
        {{ t('admin.notifications_page.title') }}
      </h2>
      <p class="text-(--ui-text-muted)">
        {{ t('admin.notifications_page.subtitle') }}
      </p>
    </div>

    <div class="flex items-center gap-2">
      <USelect
        v-model="typeFilter"
        :items="typeItems"
        option-attribute="label"
        value-attribute="value"
        class="min-w-44"
      />
      <UCheckbox v-model="unreadOnly" />
      <span class="text-sm">{{ t('notifications.unread_only') }}</span>
      <UButton
        size="sm"
        color="neutral"
        variant="outline"
        :disabled="selectedIds.length === 0 || submitting"
        @click="applyAction('read')"
      >
        {{ t('admin.notifications_page.mark_read_selected') }}
      </UButton>
      <UButton
        size="sm"
        color="neutral"
        variant="outline"
        :disabled="selectedIds.length === 0 || submitting"
        @click="applyAction('unread')"
      >
        {{ t('admin.notifications_page.mark_unread_selected') }}
      </UButton>
      <UButton
        size="sm"
        color="error"
        variant="outline"
        :disabled="selectedIds.length === 0 || submitting"
        @click="applyAction('delete')"
      >
        {{ t('admin.notifications_page.delete_selected') }}
      </UButton>
      <UButton
        size="sm"
        color="primary"
        variant="outline"
        @click="exportCsv"
      >
        {{ t('admin.notifications_page.export_csv') }}
      </UButton>
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-(--ui-border) bg-(--ui-bg-elevated)/50 text-(--ui-text-muted)">
            <tr>
              <th class="px-4 py-3 font-medium" />
              <th class="px-4 py-3 font-medium">
                {{ t('admin.notifications_page.col_user') }}
              </th>
              <th class="px-4 py-3 font-medium">
                {{ t('admin.notifications_page.col_type') }}
              </th>
              <th class="px-4 py-3 font-medium">
                {{ t('admin.notifications_page.col_title') }}
              </th>
              <th class="px-4 py-3 font-medium">
                {{ t('admin.notifications_page.col_created') }}
              </th>
              <th class="px-4 py-3 font-medium">
                {{ t('admin.notifications_page.col_read') }}
              </th>
              <th class="px-4 py-3 font-medium">
                {{ t('common.actions') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending">
              <td
                colspan="7"
                class="px-4 py-8 text-center text-(--ui-text-muted)"
              >
                {{ t('admin.notifications_page.loading') }}
              </td>
            </tr>
            <tr v-else-if="items.length === 0">
              <td
                colspan="7"
                class="px-4 py-8 text-center text-(--ui-text-muted)"
              >
                {{ t('admin.notifications_page.empty') }}
              </td>
            </tr>
            <tr
              v-for="row in items"
              :key="row.id"
              class="border-b border-(--ui-border) last:border-0"
            >
              <td class="px-4 py-3">
                <UCheckbox
                  :model-value="selectedIds.includes(row.id)"
                  @update:model-value="(v) => setSelected(row.id, v)"
                />
              </td>
              <td class="px-4 py-3">
                {{ row.userName }}
              </td>
              <td class="px-4 py-3">
                {{ row.type }}
              </td>
              <td class="px-4 py-3">
                <div class="font-medium">
                  {{ row.title }}
                </div>
                <div class="text-xs text-(--ui-text-muted) line-clamp-2">
                  {{ row.messageText || row.message }}
                </div>
              </td>
              <td class="px-4 py-3">
                {{ row.createdAt }}
              </td>
              <td class="px-4 py-3">
                <UBadge
                  :color="row.readAt ? 'neutral' : 'primary'"
                  variant="subtle"
                >
                  {{ row.readAt ? t('notifications.read') : t('notifications.unread') }}
                </UBadge>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <UButton
                    v-if="row.targetUrl"
                    size="xs"
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-external-link"
                    :to="row.targetUrl"
                  >
                    {{ t('notifications.open_resource') }}
                  </UButton>
                  <UButton
                    v-if="row.type === 'resource_review_report' && row.resourceId && extractReviewIdFromNotification(row)"
                    size="xs"
                    color="error"
                    variant="outline"
                    icon="i-lucide-trash-2"
                    :loading="deletingReviewId === row.id"
                    @click="deleteReportedReview(row)"
                  >
                    {{ t('admin.notifications_page.delete_reported_review') }}
                  </UButton>
                  <UButton
                    v-if="row.type === 'resource_update_report' && row.resourceId && extractUpdateIdFromNotification(row)"
                    size="xs"
                    color="error"
                    variant="outline"
                    icon="i-lucide-trash-2"
                    :loading="deletingUpdateId === row.id"
                    @click="deleteReportedUpdate(row)"
                  >
                    {{ t('admin.notifications_page.delete_reported_update') }}
                  </UButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <div class="flex items-center justify-end gap-2">
      <UButton
        size="xs"
        color="neutral"
        variant="outline"
        :disabled="page <= 1"
        @click="page = page - 1"
      >
        {{ t('notifications.prev_page') }}
      </UButton>
      <span class="text-sm">{{ page }} / {{ totalPages }}</span>
      <UButton
        size="xs"
        color="neutral"
        variant="outline"
        :disabled="page >= totalPages"
        @click="page = page + 1"
      >
        {{ t('notifications.next_page') }}
      </UButton>
    </div>
  </div>
</template>
