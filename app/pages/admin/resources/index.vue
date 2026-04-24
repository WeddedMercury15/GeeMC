<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: 'admin',
  ssr: false
})

const { t } = useI18n()
const toast = useToast()

useHead({
  title: () => t('admin.resources_page.title')
})

type AdminResourceItem = {
  id: string
  title: string
  categoryKey: string
  categoryName?: string | null
  authorUserId: number
  authorName: string
  teamMemberUserIds?: number[]
  teamMemberNames?: string[]
  viewCount?: number
  resourceState: string
  updateDate: string
  publishedAt: string
  updateCount: number
}

type AdminCategoryItem = {
  slug: string
  name: string
}

type ResourceStateLogItem = {
  id: number
  action: string
  source: string
  fromState: string
  toState: string
  reason: string
  createdAt: string
  actorName: string
}

const stateFilter = ref<'all' | 'visible' | 'moderated' | 'deleted'>('all')
const categoryFilter = ref('')
const keyword = ref('')
const page = ref(1)
const pageSize = ref(20)
const selectedIds = ref<string[]>([])
const submitting = ref(false)
const actionReason = ref('')
const logsOpen = ref(false)
const activeLogsResource = ref<AdminResourceItem | null>(null)
const logItems = ref<ResourceStateLogItem[]>([])
const loadingLogs = ref(false)
const logFrom = ref('')
const logTo = ref('')
const logPage = ref(1)
const logPageSize = ref(20)
const logTotal = ref(0)
const pageSizeItems = computed(() => [
  { label: '20', value: 20 },
  { label: '50', value: 50 },
  { label: '100', value: 100 }
])

function toIsoDateInput(value: string) {
  if (!value) return undefined
  const dt = new Date(value)
  return Number.isNaN(dt.getTime()) ? undefined : dt.toISOString()
}

const logAction = ref<'all' | 'hide' | 'restore' | 'delete'>('all')
const confirmOpen = ref(false)
const pendingIntent = ref<'hide' | 'restore' | 'delete'>('hide')
const pendingIds = ref<string[]>([])
const rollbackReason = ref('')
const rollbacking = ref(false)
const rollbackConfirmOpen = ref(false)
const pendingRollbackLogId = ref<number | null>(null)

const { data, pending, refresh } = await useAsyncData(
  'admin-resources-page',
  () => $fetch<{ items: AdminResourceItem[], categories: AdminCategoryItem[], total: number, page: number, pageSize: number }>('/api/admin/resources/page', {
    query: {
      state: stateFilter.value,
      category: categoryFilter.value === 'all' ? undefined : categoryFilter.value,
      keyword: keyword.value || undefined,
      page: page.value,
      pageSize: pageSize.value
    }
  }),
  { watch: [stateFilter, categoryFilter, keyword, page, pageSize] }
)

const items = computed(() => data.value?.items ?? [])
const categories = computed(() => data.value?.categories ?? [])
const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const logTotalPages = computed(() => Math.max(1, Math.ceil(logTotal.value / logPageSize.value)))

const stateItems = computed(() => [
  { label: t('admin.resources_page.state_all'), value: 'all' },
  { label: t('admin.resources_page.state_visible'), value: 'visible' },
  { label: t('admin.resources_page.state_moderated'), value: 'moderated' },
  { label: t('admin.resources_page.state_deleted'), value: 'deleted' }
])

const categoryItems = computed(() => [
  { label: t('admin.resources_page.category_all'), value: 'all' },
  ...categories.value.map(c => ({ label: c.name, value: c.slug }))
])

const allChecked = computed({
  get: () => items.value.length > 0 && selectedIds.value.length === items.value.length,
  set: (checked: boolean) => {
    selectedIds.value = checked ? items.value.map(i => i.id) : []
  }
})

watch(items, () => {
  const valid = new Set(items.value.map(i => i.id))
  selectedIds.value = selectedIds.value.filter(id => valid.has(id))
})

watch([stateFilter, categoryFilter, keyword], () => {
  page.value = 1
})

watch(pageSize, () => {
  page.value = 1
})

function setSelected(id: string, checked: boolean | 'indeterminate') {
  if (checked === 'indeterminate') return
  if (checked) {
    if (!selectedIds.value.includes(id)) selectedIds.value = [...selectedIds.value, id]
    return
  }
  selectedIds.value = selectedIds.value.filter(x => x !== id)
}

function stateLabel(state: string) {
  if (state === 'visible') return t('admin.resources_page.state_visible')
  if (state === 'moderated') return t('admin.resources_page.state_moderated')
  if (state === 'deleted') return t('admin.resources_page.state_deleted')
  return state
}

async function applyState(intent: 'hide' | 'restore' | 'delete', ids?: string[]) {
  const targetIds = ids && ids.length > 0 ? ids : [...selectedIds.value]
  if (targetIds.length === 0) return
  pendingIntent.value = intent
  pendingIds.value = targetIds
  confirmOpen.value = true
}

const confirmTitle = computed(() => {
  if (pendingIntent.value === 'hide') return t('admin.resources_page.confirm_hide_title')
  if (pendingIntent.value === 'restore') return t('admin.resources_page.confirm_restore_title')
  return t('admin.resources_page.confirm_delete_title')
})

const confirmDesc = computed(() => {
  if (pendingIntent.value === 'hide') return t('admin.resources_page.confirm_hide_desc', { count: pendingIds.value.length })
  if (pendingIntent.value === 'restore') return t('admin.resources_page.confirm_restore_desc', { count: pendingIds.value.length })
  return t('admin.resources_page.confirm_delete_desc', { count: pendingIds.value.length })
})

async function confirmApplyState() {
  const targetIds = pendingIds.value
  if (targetIds.length === 0) return
  submitting.value = true
  try {
    await $fetch('/api/admin/resources/state.manage', {
      method: 'POST',
      body: { ids: targetIds, intent: pendingIntent.value, reason: actionReason.value || undefined }
    })
    selectedIds.value = []
    confirmOpen.value = false
    await refresh()
    toast.add({ title: t('common.success'), description: t('admin.resources_page.state_updated'), color: 'success' })
  } catch {
    toast.add({ title: t('common.error'), description: t('admin.resources_page.state_update_failed'), color: 'error' })
  } finally {
    submitting.value = false
  }
}

async function openLogs(row: AdminResourceItem) {
  activeLogsResource.value = row
  logsOpen.value = true
  logPage.value = 1
  await fetchLogs()
}

async function fetchLogs() {
  if (!activeLogsResource.value) return
  loadingLogs.value = true
  try {
    const res = await $fetch<{ items: ResourceStateLogItem[], total: number, page: number, pageSize: number }>('/api/admin/resources/state-logs', {
      query: {
        resourceId: activeLogsResource.value.id,
        from: toIsoDateInput(logFrom.value) || undefined,
        to: toIsoDateInput(logTo.value) || undefined,
        action: logAction.value === 'all' ? undefined : logAction.value,
        page: logPage.value,
        pageSize: logPageSize.value
      }
    })
    logItems.value = res.items
    logTotal.value = res.total
    logPage.value = res.page
    logPageSize.value = res.pageSize
  } catch {
    logItems.value = []
    logTotal.value = 0
    toast.add({ title: t('common.error'), description: t('admin.resources_page.logs_load_failed'), color: 'error' })
  } finally {
    loadingLogs.value = false
  }
}

function logActionLabel(action: string) {
  if (action === 'hide') return t('admin.resources_page.log_action_hide')
  if (action === 'restore') return t('admin.resources_page.log_action_restore')
  if (action === 'delete') return t('admin.resources_page.log_action_delete')
  if (action === 'rollback') return t('admin.resources_page.log_action_rollback')
  return action
}

function logSourceLabel(source: string) {
  if (source === 'admin_batch') return t('admin.resources_page.log_source_admin_batch')
  if (source === 'owner_self') return t('admin.resources_page.log_source_owner_self')
  if (source === 'team_member') return t('admin.resources_page.log_source_team_member')
  if (source === 'admin_rollback') return t('admin.resources_page.log_source_admin_rollback')
  return source
}

async function rollbackByLog(logId: number) {
  pendingRollbackLogId.value = logId
  rollbackConfirmOpen.value = true
}

async function confirmRollback() {
  if (!pendingRollbackLogId.value) return
  rollbacking.value = true
  try {
    await $fetch('/api/admin/resources/state-logs.rollback', {
      method: 'POST',
      body: { logId: pendingRollbackLogId.value, reason: rollbackReason.value || undefined }
    })
    await refresh()
    await fetchLogs()
    rollbackConfirmOpen.value = false
    toast.add({ title: t('common.success'), description: t('admin.resources_page.rollback_success'), color: 'success' })
  } catch {
    toast.add({ title: t('common.error'), description: t('admin.resources_page.rollback_failed'), color: 'error' })
  } finally {
    rollbacking.value = false
    pendingRollbackLogId.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-3xl font-bold tracking-tight">
        {{ t('admin.resources_page.title') }}
      </h2>
      <p class="text-(--ui-text-muted)">
        {{ t('admin.resources_page.subtitle') }}
      </p>
    </div>

    <div class="grid gap-3 md:grid-cols-4">
      <UInput v-model="keyword" icon="i-lucide-search" :placeholder="t('admin.resources_page.search_placeholder')" />
      <USelect v-model="stateFilter" :items="stateItems" option-attribute="label" value-attribute="value" />
      <USelect v-model="categoryFilter" :items="categoryItems" option-attribute="label" value-attribute="value" />
      <UInput v-model="actionReason" :placeholder="t('admin.resources_page.reason_placeholder')" />
      <div class="flex items-center gap-2 md:col-span-4">
        <UButton size="sm" color="warning" variant="outline" :disabled="selectedIds.length === 0 || submitting" @click="applyState('hide')">
          {{ t('admin.resources_page.hide_selected') }}
        </UButton>
        <UButton size="sm" color="success" variant="outline" :disabled="selectedIds.length === 0 || submitting" @click="applyState('restore')">
          {{ t('admin.resources_page.restore_selected') }}
        </UButton>
        <UButton size="sm" color="error" variant="outline" :disabled="selectedIds.length === 0 || submitting" @click="applyState('delete')">
          {{ t('admin.resources_page.delete_selected') }}
        </UButton>
      </div>
    </div>

    <div class="flex items-center justify-between text-sm text-(--ui-text-muted)">
      <div>{{ t('admin.resources_page.total', { total }) }}</div>
      <div class="flex items-center gap-2">
        <USelect v-model="pageSize" :items="pageSizeItems" option-attribute="label" value-attribute="value" />
        <UButton size="xs" color="neutral" variant="outline" :disabled="page <= 1" @click="page = page - 1">{{ t('admin.resources_page.prev_page') }}</UButton>
        <span>{{ page }} / {{ totalPages }}</span>
        <UButton size="xs" color="neutral" variant="outline" :disabled="page >= totalPages" @click="page = page + 1">{{ t('admin.resources_page.next_page') }}</UButton>
      </div>
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-(--ui-border) bg-(--ui-bg-elevated)/50 text-(--ui-text-muted)">
            <tr>
              <th class="px-3 py-3">
                <UCheckbox v-model="allChecked" />
              </th>
              <th class="px-4 py-3 font-medium">{{ t('admin.resources_page.col_title') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('admin.resources_page.col_category') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('admin.resources_page.col_author') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('admin.resources_page.col_team') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('admin.resources_page.col_views') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('admin.resources_page.col_state') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('admin.resources_page.col_updated') }}</th>
              <th class="px-4 py-3 font-medium text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending">
              <td colspan="9" class="px-4 py-8 text-center text-(--ui-text-muted)">
                {{ t('admin.resources_page.loading') }}
              </td>
            </tr>
            <tr v-else-if="items.length === 0">
              <td colspan="9" class="px-4 py-8 text-center text-(--ui-text-muted)">
                {{ t('admin.resources_page.empty') }}
              </td>
            </tr>
            <tr v-for="row in items" :key="row.id" class="border-b border-(--ui-border) last:border-0">
              <td class="px-3 py-3">
                <UCheckbox :model-value="selectedIds.includes(row.id)" @update:model-value="(v) => setSelected(row.id, v)" />
              </td>
              <td class="px-4 py-3">
                <NuxtLink :to="`/${row.categoryKey}/${row.id}`" class="font-medium text-(--ui-primary) hover:underline">
                  {{ row.title }}
                </NuxtLink>
                <div class="text-xs text-(--ui-text-muted)">{{ row.id }}</div>
              </td>
              <td class="px-4 py-3">{{ row.categoryName || row.categoryKey }}</td>
              <td class="px-4 py-3">{{ row.authorName }}</td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="name in (row.teamMemberNames || [])"
                    :key="name"
                    color="neutral"
                    variant="outline"
                    size="xs"
                  >
                    {{ name }}
                  </UBadge>
                </div>
              </td>
              <td class="px-4 py-3">{{ row.viewCount ?? 0 }}</td>
              <td class="px-4 py-3">
                <UBadge :color="row.resourceState === 'visible' ? 'success' : row.resourceState === 'moderated' ? 'warning' : 'error'" variant="subtle">
                  {{ stateLabel(row.resourceState) }}
                </UBadge>
              </td>
              <td class="px-4 py-3">{{ row.updateDate }}</td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-2">
                  <UButton size="xs" color="warning" variant="outline" @click="applyState('hide', [row.id])">{{ t('admin.resources_page.hide') }}</UButton>
                  <UButton size="xs" color="success" variant="outline" @click="applyState('restore', [row.id])">{{ t('admin.resources_page.restore') }}</UButton>
                  <UButton size="xs" color="error" variant="outline" @click="applyState('delete', [row.id])">{{ t('admin.resources_page.delete') }}</UButton>
                  <UButton size="xs" color="neutral" variant="outline" @click="openLogs(row)">{{ t('admin.resources_page.logs') }}</UButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <USlideover v-model:open="logsOpen">
      <template #content>
        <div class="p-4 space-y-4">
          <div>
            <div class="text-lg font-semibold">{{ t('admin.resources_page.logs_title') }}</div>
            <div class="text-sm text-(--ui-text-muted)">{{ activeLogsResource?.title }}</div>
          </div>
          <div class="grid grid-cols-1 gap-2">
            <UInput v-model="logFrom" type="datetime-local" :placeholder="t('admin.resources_page.log_from_placeholder')" />
            <UInput v-model="logTo" type="datetime-local" :placeholder="t('admin.resources_page.log_to_placeholder')" />
            <USelect
              v-model="logAction"
              :items="[
                { label: t('admin.resources_page.log_action_all'), value: 'all' },
                { label: t('admin.resources_page.log_action_hide'), value: 'hide' },
                { label: t('admin.resources_page.log_action_restore'), value: 'restore' },
                { label: t('admin.resources_page.log_action_delete'), value: 'delete' }
              ]"
              option-attribute="label"
              value-attribute="value"
            />
            <UButton
              size="sm"
              color="neutral"
              variant="outline"
              @click="logPage = 1; fetchLogs()"
            >
              {{ t('admin.resources_page.apply_log_filter') }}
            </UButton>
            <UButton
              size="sm"
              color="primary"
              variant="outline"
              @click="activeLogsResource && navigateTo(`/api/admin/resources/state-logs.export?resourceId=${encodeURIComponent(activeLogsResource.id)}&from=${encodeURIComponent(toIsoDateInput(logFrom) || '')}&to=${encodeURIComponent(toIsoDateInput(logTo) || '')}&action=${encodeURIComponent(logAction === 'all' ? '' : logAction)}`, { external: true })"
            >
              {{ t('admin.resources_page.export_csv') }}
            </UButton>
            <UInput v-model="rollbackReason" :placeholder="t('admin.resources_page.rollback_reason_placeholder')" />
          </div>
          <div class="flex items-center justify-between text-xs text-(--ui-text-muted)">
            <div>{{ t('admin.resources_page.total', { total: logTotal }) }}</div>
            <div class="flex items-center gap-2">
              <USelect
                v-model="logPageSize"
                :items="pageSizeItems"
                option-attribute="label"
                value-attribute="value"
                @update:model-value="() => { logPage = 1; fetchLogs() }"
              />
              <UButton size="xs" color="neutral" variant="outline" :disabled="logPage <= 1" @click="logPage = logPage - 1; fetchLogs()">
                {{ t('admin.resources_page.prev_page') }}
              </UButton>
              <span>{{ logPage }} / {{ logTotalPages }}</span>
              <UButton size="xs" color="neutral" variant="outline" :disabled="logPage >= logTotalPages" @click="logPage = logPage + 1; fetchLogs()">
                {{ t('admin.resources_page.next_page') }}
              </UButton>
            </div>
          </div>
          <UCard v-if="loadingLogs">
            <div class="text-sm text-(--ui-text-muted)">{{ t('admin.resources_page.loading') }}</div>
          </UCard>
          <UCard v-else-if="logItems.length === 0">
            <div class="text-sm text-(--ui-text-muted)">{{ t('admin.resources_page.logs_empty') }}</div>
          </UCard>
          <div v-else class="space-y-3">
            <UCard v-for="log in logItems" :key="log.id">
              <div class="flex items-center justify-between gap-2">
                <div class="font-medium">{{ log.actorName }}</div>
                <div class="text-xs text-(--ui-text-muted)">{{ log.createdAt }}</div>
              </div>
              <div class="text-sm mt-2">
                {{ log.fromState }} -> {{ log.toState }} ({{ logActionLabel(log.action) }})
              </div>
              <div class="text-xs text-(--ui-text-muted) mt-1">
                {{ t('admin.resources_page.log_source') }}: {{ logSourceLabel(log.source) }}
              </div>
              <div v-if="log.reason" class="text-xs text-(--ui-text-muted) mt-2">
                {{ t('admin.resources_page.reason') }}: {{ log.reason }}
              </div>
              <div class="mt-3">
                <UButton size="xs" color="warning" variant="outline" :loading="rollbacking" @click="rollbackByLog(log.id)">
                  {{ t('admin.resources_page.rollback_to_from_state') }}
                </UButton>
              </div>
            </UCard>
          </div>
        </div>
      </template>
    </USlideover>

    <UModal v-model:open="confirmOpen">
      <UCard>
        <template #header>
          <div class="font-semibold">{{ confirmTitle }}</div>
        </template>
        <div class="space-y-4">
          <div class="text-sm text-(--ui-text-muted)">{{ confirmDesc }}</div>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="confirmOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" :loading="submitting" @click="confirmApplyState">{{ t('common.confirm') }}</UButton>
          </div>
        </div>
      </UCard>
    </UModal>

    <UModal v-model:open="rollbackConfirmOpen">
      <UCard>
        <template #header>
          <div class="font-semibold">{{ t('admin.resources_page.rollback_confirm_title') }}</div>
        </template>
        <div class="space-y-4">
          <div class="text-sm text-(--ui-text-muted)">
            {{ t('admin.resources_page.rollback_confirm_desc') }}
          </div>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="rollbackConfirmOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="warning" :loading="rollbacking" @click="confirmRollback">{{ t('common.confirm') }}</UButton>
          </div>
        </div>
      </UCard>
    </UModal>
  </div>
</template>

