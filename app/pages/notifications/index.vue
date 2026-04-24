<script setup lang="ts">
const { t } = useI18n()
const auth = useAuth()
const page = ref(1)
const pageSize = ref(20)
const unreadOnly = ref(false)
const typeFilter = ref('all')
const selectedIds = ref<number[]>([])
const toast = useToast()

if (!auth.isLoggedIn.value) {
  throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
}

const { data, pending, refresh } = await useAsyncData(
  'notifications-page',
  () => $fetch<{ items: Array<{
    id: number
    type: string
    title: string
    message: string
    messageText?: string
    resourceId: string | null
    resourceCategoryKey: string | null
    targetUrl?: string | null
    readAt: string
    createdAt: string
  }>, total: number, unreadTotal: number, page: number, pageSize: number }>('/api/notifications', {
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

const groupedItems = computed(() => {
  const out: Array<{ key: string, ids: number[], item: any, count: number }> = []
  for (const n of items.value) {
    const last = out[out.length - 1]
    const key = `${n.type}:${n.resourceId || ''}:${n.targetUrl || ''}`
    if (last && last.key === key) {
      last.ids.push(n.id)
      last.count += 1
      // if any unread inside group, keep unread badge on the group item
      if (!n.readAt) last.item.readAt = ''
      continue
    }
    out.push({ key, ids: [n.id], item: { ...n }, count: 1 })
  }
  return out
})
const total = computed(() => data.value?.total ?? 0)
const unreadTotal = computed(() => data.value?.unreadTotal ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const typeItems = computed(() => [
  { label: t('notifications.type_all'), value: 'all' },
  { label: t('notifications.type_resource_update'), value: 'resource_update' },
  { label: t('notifications.type_resource_version'), value: 'resource_version' },
  { label: t('notifications.type_resource_description'), value: 'resource_description' }
])

async function markRead(id: number) {
  try {
    await $fetch('/api/notifications/read', { method: 'POST', body: { id } })
    await refresh()
  } catch {
    toast.add({ title: t('common.error'), description: t('notifications.mark_read_failed'), color: 'error' })
  }
}

async function markSelectedReadFromGroup(ids: number[]) {
  if (!ids || ids.length === 0) return
  try {
    await $fetch('/api/notifications/read', { method: 'POST', body: { ids, action: 'read' } })
    await refresh()
  } catch {
    toast.add({ title: t('common.error'), description: t('notifications.mark_read_failed'), color: 'error' })
  }
}

function setSelected(id: number, checked: boolean | 'indeterminate') {
  if (checked === 'indeterminate') return
  if (checked) {
    if (!selectedIds.value.includes(id)) selectedIds.value = [...selectedIds.value, id]
    return
  }
  selectedIds.value = selectedIds.value.filter(x => x !== id)
}

function setSelectedMany(ids: number[], checked: boolean | 'indeterminate') {
  if (checked === 'indeterminate') return
  if (checked) {
    const set = new Set(selectedIds.value)
    for (const id of ids) set.add(id)
    selectedIds.value = [...set]
    return
  }
  const remove = new Set(ids)
  selectedIds.value = selectedIds.value.filter(x => !remove.has(x))
}

async function markSelectedRead() {
  if (selectedIds.value.length === 0) return
  try {
    await $fetch('/api/notifications/read', { method: 'POST', body: { ids: selectedIds.value, action: 'read' } })
    selectedIds.value = []
    await refresh()
  } catch {
    toast.add({ title: t('common.error'), description: t('notifications.mark_read_failed'), color: 'error' })
  }
}

async function markAllRead() {
  try {
    await $fetch('/api/notifications/read', { method: 'POST', body: { all: true, action: 'read' } })
    selectedIds.value = []
    await refresh()
  } catch {
    toast.add({ title: t('common.error'), description: t('notifications.mark_read_failed'), color: 'error' })
  }
}

async function markSelectedUnread() {
  if (selectedIds.value.length === 0) return
  try {
    await $fetch('/api/notifications/read', { method: 'POST', body: { ids: selectedIds.value, action: 'unread' } })
    selectedIds.value = []
    await refresh()
  } catch {
    toast.add({ title: t('common.error'), description: t('notifications.mark_read_failed'), color: 'error' })
  }
}

async function deleteSelected() {
  if (selectedIds.value.length === 0) return
  try {
    await $fetch('/api/notifications/read', { method: 'POST', body: { ids: selectedIds.value, action: 'delete' } })
    selectedIds.value = []
    await refresh()
  } catch {
    toast.add({ title: t('common.error'), description: t('notifications.mark_read_failed'), color: 'error' })
  }
}
</script>

<template>
  <UContainer class="py-6 space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold">{{ t('notifications.title') }}</h2>
        <p class="text-sm text-(--ui-text-muted)">{{ t('notifications.unread_total', { total: unreadTotal }) }}</p>
      </div>
      <div class="flex items-center gap-2">
        <USelect v-model="typeFilter" :items="typeItems" option-attribute="label" value-attribute="value" class="min-w-44" />
        <UCheckbox v-model="unreadOnly" />
        <span class="text-sm">{{ t('notifications.unread_only') }}</span>
        <UButton size="xs" color="neutral" variant="outline" :disabled="selectedIds.length === 0" @click="markSelectedRead">
          {{ t('notifications.mark_selected_read') }}
        </UButton>
        <UButton size="xs" color="neutral" variant="outline" :disabled="selectedIds.length === 0" @click="markSelectedUnread">
          {{ t('notifications.mark_selected_unread') }}
        </UButton>
        <UButton size="xs" color="error" variant="outline" :disabled="selectedIds.length === 0" @click="deleteSelected">
          {{ t('notifications.delete_selected') }}
        </UButton>
        <UButton size="xs" color="primary" variant="outline" @click="markAllRead">
          {{ t('notifications.mark_all_read') }}
        </UButton>
      </div>
    </div>

    <UCard>
      <div v-if="pending" class="py-8 text-center text-(--ui-text-muted)">{{ t('notifications.loading') }}</div>
      <div v-else-if="items.length === 0" class="py-8 text-center text-(--ui-text-muted)">{{ t('notifications.empty') }}</div>
      <div v-else class="space-y-3">
        <div v-for="g in groupedItems" :key="g.key" class="border border-(--ui-border) rounded-lg p-3">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <UCheckbox :model-value="g.ids.every((id) => selectedIds.includes(id))" @update:model-value="(v) => setSelectedMany(g.ids, v)" />
              <div class="font-medium">{{ g.item.title }}</div>
              <UBadge v-if="g.count > 1" color="neutral" variant="subtle" size="xs">
                {{ t('notifications.group_more', { n: g.count - 1 }) }}
              </UBadge>
            </div>
            <UBadge :color="g.item.readAt ? 'neutral' : 'primary'" variant="subtle">
              {{ g.item.readAt ? t('notifications.read') : t('notifications.unread') }}
            </UBadge>
          </div>
          <div class="text-sm text-(--ui-text-muted) mt-1">{{ g.item.messageText || g.item.message }}</div>
          <div class="mt-2 flex items-center justify-between">
            <NuxtLink
              v-if="g.item.resourceId && g.item.resourceCategoryKey"
              :to="g.item.targetUrl || `/${g.item.resourceCategoryKey}/${g.item.resourceId}`"
              class="text-xs text-(--ui-primary) hover:underline"
            >
              {{ t('notifications.open_resource') }}
            </NuxtLink>
            <div class="text-xs text-(--ui-text-muted)">{{ g.item.createdAt }}</div>
          </div>
          <div class="mt-2">
            <UButton v-if="!g.item.readAt" size="xs" color="neutral" variant="outline" @click="markSelectedReadFromGroup(g.ids)">
              {{ t('notifications.mark_read') }}
            </UButton>
          </div>
        </div>
      </div>
    </UCard>

    <div class="flex items-center justify-end gap-2">
      <UButton size="xs" color="neutral" variant="outline" :disabled="page <= 1" @click="page = page - 1">{{ t('notifications.prev_page') }}</UButton>
      <span class="text-sm">{{ page }} / {{ totalPages }}</span>
      <UButton size="xs" color="neutral" variant="outline" :disabled="page >= totalPages" @click="page = page + 1">{{ t('notifications.next_page') }}</UButton>
    </div>
  </UContainer>
</template>

