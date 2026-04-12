<script setup lang="ts">
import type { ResourceListItem } from '~/utils/resourceCatalog'

const { t } = useI18n()
const { formatTime } = useFormatTime()
const route = useRoute()
const router = useRouter()
const auth = useAuth()
const toast = useToast()

const { data: resourcesData } = await useAsyncData('resources-list', () =>
  $fetch<{ items: ResourceListItem[], total: number }>('/api/resources'))

type ViewMode = 'card' | 'list'

const searchQuery = ref('')
const sortBy = ref<'hot' | 'new' | 'downloads'>('hot')
const viewMode = ref<ViewMode>('card')

const currentPage = ref(1)
const pageSize = ref(24)

const sortOptions = computed(() => [
  { label: t('resources.sort_hot'), value: 'hot' as const },
  { label: t('resources.sort_new'), value: 'new' as const },
  { label: t('resources.sort_downloads'), value: 'downloads' as const }
])

const isResourcesIndex = computed(() => route.path === '/resources')

const handleUpload = () => {
  if (!auth.canPublish.value) {
    toast.add({
      title: t('resources.upload_restricted_title'),
      description: t('resources.upload_restricted_desc'),
      color: 'warning'
    })
    return
  }
  toast.add({
    title: t('resources.upload_placeholder_title'),
    description: t('resources.upload_placeholder_desc'),
    color: 'primary'
  })
}

const resources = computed<ResourceListItem[]>(() => {
  let list = [...(resourcesData.value?.items ?? [])]

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(r =>
      r.title.toLowerCase().includes(q)
      || r.description.toLowerCase().includes(q)
      || r.tags.some(tag => tag.toLowerCase().includes(q))
    )
  }

  if (sortBy.value === 'new') {
    list = list.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  } else if (sortBy.value === 'downloads') {
    list = list.sort((a, b) => b.downloads.localeCompare(a.downloads))
  }

  return list
})

const totalCount = computed(() => resources.value.length)

const pagedResources = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return resources.value.slice(start, start + pageSize.value)
})

const clearAllFilters = () => {
  searchQuery.value = ''
  sortBy.value = 'hot'
}

const handlePointerMove = (e: PointerEvent) => {
  const el = e.currentTarget as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
  const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
  el.style.setProperty('--mx', `${x}px`)
  el.style.setProperty('--my', `${y}px`)
}
</script>

<template>
  <UContainer class="py-5">
    <div class="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-4">
      <UCard
        class="hidden lg:block h-fit sticky top-22"
        :ui="{ body: '!p-2' }"
      >
        <UButton
          color="neutral"
          :variant="isResourcesIndex ? 'soft' : 'ghost'"
          icon="i-lucide-list"
          class="justify-start w-full"
          @click="router.push('/resources')"
        >
          {{ t('resources.sidebar_all') }}
        </UButton>
      </UCard>

      <div class="flex flex-col gap-3 min-w-0">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          :placeholder="t('resources.search_placeholder')"
          class="md:max-w-md"
        />
        <div class="flex items-center gap-2">
          <div class="inline-flex h-9 items-center p-0.5 bg-neutral-100 dark:bg-neutral-900/50 border border-(--ui-border) rounded-lg shadow-inner overflow-x-auto no-scrollbar">
            <button
              v-for="item in sortOptions"
              :key="item.value"
              class="h-7 flex items-center justify-center gap-2 px-3 text-sm rounded-md transition-all duration-200 whitespace-nowrap"
              :class="sortBy === item.value
                ? 'bg-white dark:bg-neutral-800 text-primary-600 dark:text-primary-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10 font-medium'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'"
              @click="sortBy = item.value"
            >
              {{ item.label }}
            </button>
          </div>
          <UButton
            color="primary"
            icon="i-lucide-upload"
            @click="handleUpload"
          >
            {{ t('resources.upload') }}
          </UButton>
        </div>
      </div>

      <div class="flex items-center justify-between text-sm text-muted">
        <div>
          <i18n-t
            keypath="resources.total_count"
            tag="span"
          >
            <template #count>
              <span class="font-semibold text-(--ui-text)">{{ totalCount }}</span>
            </template>
          </i18n-t>
        </div>
        <div class="inline-flex items-center rounded-lg bg-neutral-100 dark:bg-neutral-900/50 border border-(--ui-border) p-1">
          <UButton
            :variant="viewMode === 'card' ? 'solid' : 'ghost'"
            :color="viewMode === 'card' ? 'primary' : 'neutral'"
            icon="i-lucide-layout-grid"
            size="sm"
            class="rounded-md"
            @click="viewMode = 'card'"
          />
          <UButton
            :variant="viewMode === 'list' ? 'solid' : 'ghost'"
            :color="viewMode === 'list' ? 'primary' : 'neutral'"
            icon="i-lucide-list"
            size="sm"
            class="rounded-md"
            @click="viewMode = 'list'"
          />
        </div>
      </div>

      <div
        v-if="pagedResources.length === 0"
        class="flex w-full min-w-0 flex-col gap-6"
      >
        <UEmpty
          class="w-full"
          :title="t('resources.list_empty_title')"
          :description="t('resources.list_empty_desc')"
        />
        <div class="flex w-full flex-wrap items-center justify-center gap-2">
          <UButton
            color="neutral"
            variant="outline"
            @click="clearAllFilters"
          >
            {{ t('resources.clear_filters') }}
          </UButton>
          <UButton
            color="primary"
            @click="handleUpload"
          >
            {{ t('resources.upload_first') }}
          </UButton>
        </div>
      </div>

      <div
        v-else-if="viewMode === 'card'"
        class="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <UCard
          v-for="res in pagedResources"
          :key="res.id"
          :ui="{
            root: [
              'group relative isolate overflow-hidden cursor-pointer transition-all',
              'ring-1 ring-neutral-200/60 dark:ring-white/10',
              'border border-neutral-200/70 dark:border-white/10',
              'bg-white dark:bg-neutral-900/40 backdrop-blur-xl',
              'hover:border-primary-500/45 dark:hover:border-primary-400/45',
              'hover:shadow-lg hover:shadow-primary-500/5'
            ].join(' '),
            body: '!p-4'
          }"
          @click="router.push(`/${res.categoryKey}/${res.id}`)"
          @pointermove="handlePointerMove"
        >
          <div class="relative z-10 aspect-[16/9] rounded-md overflow-hidden bg-(--ui-bg-elevated) border border-(--ui-border)">
            <img
              :src="res.cover"
              :alt="res.title"
              class="w-full h-full object-cover"
            >
          </div>

          <div class="relative z-10 mt-3 min-w-0">
            <div class="font-semibold truncate pr-18">
              {{ res.title }}
            </div>
            <UBadge
              color="neutral"
              variant="subtle"
              class="absolute top-0 right-0 shrink-0"
            >
              {{ res.latestVersion }}
            </UBadge>
            <div class="text-xs text-muted mt-1 line-clamp-2">
              {{ res.description }}
            </div>
          </div>

          <div class="relative z-10 mt-3 flex flex-wrap gap-2">
            <UBadge
              v-for="tag in res.tags"
              :key="tag"
              variant="subtle"
              color="primary"
            >
              {{ tag }}
            </UBadge>
          </div>

          <div class="relative z-10 mt-4 flex items-center justify-between text-xs text-muted">
            <div class="flex items-center gap-2 min-w-0">
              <UAvatar
                :src="res.authorAvatar"
                size="2xs"
              />
              <span class="truncate">{{ res.author }}</span>
            </div>
            <div class="flex items-center gap-1">
              <UIcon name="i-lucide-download" />
              <span>{{ res.downloads }}</span>
            </div>
          </div>

          <div
            class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            :style="{
              backgroundImage: `radial-gradient(520px circle at var(--mx, 50%) var(--my, 0px), rgba(255,255,255,0.06), rgba(255,255,255,0) 48%)`
            }"
          />
          <div
            class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            :style="{
              backgroundImage: `radial-gradient(640px circle at var(--mx, 50%) var(--my, 0px), rgba(34,197,94,0.10), rgba(0,0,0,0) 52%)`
            }"
          />
        </UCard>
      </div>

      <div
        v-else
        class="flex flex-col gap-2"
      >
        <UCard
          v-for="res in pagedResources"
          :key="res.id"
          class="cursor-pointer hover:shadow-md transition"
          :ui="{ body: '!p-4' }"
          @click="router.push(`/${res.categoryKey}/${res.id}`)"
        >
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-md overflow-hidden bg-(--ui-bg-elevated) border border-(--ui-border) shrink-0">
              <img
                :src="res.cover"
                :alt="res.title"
                class="w-full h-full object-cover"
              >
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <div class="font-semibold truncate">
                  {{ res.title }}
                </div>
                <div class="text-xs text-muted shrink-0">
                  {{ formatTime(res.publishedAt) }}
                </div>
              </div>
              <div class="text-xs text-muted mt-1 line-clamp-2">
                {{ res.description }}
              </div>
              <div class="mt-2 flex items-center justify-between text-xs text-muted">
                <div class="flex items-center gap-2 min-w-0">
                  <UAvatar
                    :src="res.authorAvatar"
                    size="2xs"
                  />
                  <span class="truncate">{{ res.author }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <UIcon name="i-lucide-download" />
                  <span>{{ res.downloads }}</span>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <div
        v-if="totalCount > pageSize"
        class="mt-6 flex justify-center"
      >
        <UPagination
          v-model:page="currentPage"
          :total="totalCount"
          :page-count="Math.ceil(totalCount / pageSize)"
        />
      </div>

      <div class="flex items-center justify-end pt-2 md:hidden">
        <UButton
          color="neutral"
          variant="outline"
          @click="clearAllFilters"
        >
          {{ t('resources.clear_filters') }}
        </UButton>
      </div>
      </div>
    </div>
  </UContainer>
</template>
