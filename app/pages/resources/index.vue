<script setup lang="ts">
import type { ResourceListItem } from '~/utils/resourceCatalog'

const { t } = useI18n()
const { formatTime } = useFormatTime()
const route = useRoute()
const router = useRouter()
const auth = useAuth()
const toast = useToast()

type ResourceCategoryItem = {
  id: number
  name: string
  slug: string
  parentCategoryId: number
  icon?: string
  resourcesCount: number
}

type CategoryTreeNode = {
  label: string
  value: string
  icon?: string
  children?: CategoryTreeNode[]
}

const searchQuery = ref('')
const sortBy = ref<'hot' | 'new' | 'downloads' | 'rating' | 'reviews'>('hot')
const currentPage = ref(1)
const pageSize = ref(24)

const { data: resourcesData } = await useAsyncData(
  'resources-list',
  () => {
    const q: Record<string, string> = {}
    const cg = route.query.category
    const tg = route.query.tag
    if (typeof cg === 'string' && cg) q.category = cg
    if (typeof tg === 'string' && tg) q.tag = tg
    if (searchQuery.value.trim()) q.keyword = searchQuery.value.trim()
    q.sort = sortBy.value
    q.page = String(currentPage.value)
    q.pageSize = String(pageSize.value)
    return $fetch<{ items: ResourceListItem[], total: number, page: number, pageSize: number, categories: ResourceCategoryItem[] }>('/api/resources', {
      query: q
    })
  },
  { watch: [() => route.query.category, () => route.query.tag, searchQuery, sortBy, currentPage, pageSize] }
)

type ViewMode = 'card' | 'list'

const viewMode = ref<ViewMode>('card')

const sortOptions = computed(() => [
  { label: t('resources.sort_hot'), value: 'hot' as const },
  { label: t('resources.sort_new'), value: 'new' as const },
  { label: t('resources.sort_downloads'), value: 'downloads' as const },
  { label: t('resources.sort_rating'), value: 'rating' as const },
  { label: t('resources.sort_reviews'), value: 'reviews' as const }
])

const selectedCategory = computed(() => String(route.query.category ?? ''))
const categories = computed<ResourceCategoryItem[]>(() => resourcesData.value?.categories ?? [])
const expandedCategoryTreeKeys = ref<string[]>([])
const categoryChevronTogglePending = ref(false)
const categoryTreeItems = computed<CategoryTreeNode[]>(() => {
  const byParent = new Map<number, ResourceCategoryItem[]>()
  for (const category of categories.value) {
    const parentId = Number(category.parentCategoryId ?? 0)
    const list = byParent.get(parentId) ?? []
    list.push(category)
    byParent.set(parentId, list)
  }

  const build = (parentId: number): CategoryTreeNode[] => {
    const children = (byParent.get(parentId) ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
    return children.map((child) => {
      const nodes = build(child.id)
      return {
        label: child.name,
        value: child.slug,
        icon: child.icon || 'i-lucide-folder',
        ...(nodes.length ? { children: nodes } : {})
      }
    })
  }

  return [
    {
      label: t('resources.sidebar_all'),
      value: '__all__',
      icon: 'i-lucide-list'
    },
    ...build(0)
  ]
})
const defaultExpandedCategoryTreeKeys = computed(() => {
  const keys: string[] = []
  const walk = (items: CategoryTreeNode[]) => {
    for (const item of items) {
      if (item.children?.length) {
        keys.push(String(item.value))
        walk(item.children)
      }
    }
  }
  walk(categoryTreeItems.value)
  return keys
})

function goAllResources() {
  void router.push('/resources')
}

function goCategory(slug: string) {
  void router.push({ path: '/resources', query: { ...route.query, category: slug } })
}
function onCategoryTreeSelect(item: unknown) {
  if (!item || typeof item !== 'object' || !('value' in item)) return
  const value = String((item as { value: string }).value)
  if (!value || value === '__all__') {
    goAllResources()
    return
  }
  goCategory(value)
}
function onCategoryTreeExpandedUpdate(keys: string[]) {
  if (!categoryChevronTogglePending.value) return
  expandedCategoryTreeKeys.value = keys
  categoryChevronTogglePending.value = false
}
function toggleCategoryTreeNode(handleToggle: () => void) {
  categoryChevronTogglePending.value = true
  handleToggle()
}
watch(categoryTreeItems, () => {
  expandedCategoryTreeKeys.value = [...defaultExpandedCategoryTreeKeys.value]
}, { immediate: true })

const handleUpload = () => {
  if (!auth.canPublish.value) {
    toast.add({
      title: t('resources.upload_restricted_title'),
      description: t('resources.upload_restricted_desc'),
      color: 'warning'
    })
    return
  }
  const nextQuery: Record<string, string> = {}
  if (selectedCategory.value) nextQuery.category = selectedCategory.value
  if (activeTag.value) nextQuery.tag = activeTag.value
  void router.push({ path: '/resources/create', query: nextQuery })
}

const resources = computed<ResourceListItem[]>(() => resourcesData.value?.items ?? [])
const totalCount = computed(() => Number(resourcesData.value?.total ?? 0))
const pagedResources = computed(() => resources.value)
const pendingTag = ref('')

watch([searchQuery, sortBy, () => route.query.category, () => route.query.tag], () => {
  currentPage.value = 1
})

watch(
  () => route.query.tag,
  (tag) => {
    pendingTag.value = typeof tag === 'string' ? tag : ''
  },
  { immediate: true }
)

const activeTag = computed(() => (typeof route.query.tag === 'string' ? route.query.tag : ''))
const selectedCategoryName = computed(() => {
  if (!selectedCategory.value) return ''
  return categories.value.find(c => c.slug === selectedCategory.value)?.name ?? selectedCategory.value
})
const sortLabel = computed(() => sortOptions.value.find(item => item.value === sortBy.value)?.label ?? '')

const clearAllFilters = () => {
  searchQuery.value = ''
  sortBy.value = 'hot'
  pendingTag.value = ''
  const q = { ...route.query } as Record<string, string | string[] | null | undefined>
  delete q.category
  delete q.tag
  currentPage.value = 1
  void router.push({ query: q })
}

function setTagFilter() {
  const q = { ...route.query } as Record<string, string | string[] | null | undefined>
  if (pendingTag.value.trim()) q.tag = pendingTag.value.trim()
  else delete q.tag
  void router.push({ query: q })
}

function clearCategoryFilter() {
  const q = { ...route.query } as Record<string, string | string[] | null | undefined>
  delete q.category
  void router.push({ query: q })
}

function clearTagFilter() {
  const q = { ...route.query } as Record<string, string | string[] | null | undefined>
  delete q.tag
  void router.push({ query: q })
}

function clearKeywordFilter() {
  searchQuery.value = ''
}

function clearSortFilter() {
  sortBy.value = 'hot'
}

const hasAnyFilter = computed(() => !!selectedCategory.value || !!activeTag.value || !!searchQuery.value.trim() || sortBy.value !== 'hot')

const handlePointerMove = (e: PointerEvent) => {
  const el = e.currentTarget as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
  const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
  el.style.setProperty('--mx', `${x}px`)
  el.style.setProperty('--my', `${y}px`)
}

const aspectRatioStyle = (ratio?: string) => {
  if (!ratio) return '16 / 9'
  if (ratio.includes('/')) return ratio.replace('/', ' / ')
  return ratio
}
</script>

<template>
  <UContainer class="py-5">
    <div class="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-4">
      <UCard
        class="hidden lg:block h-fit sticky top-22"
        :ui="{ body: '!p-2' }"
      >
        <UTree
          :expanded="expandedCategoryTreeKeys"
          :items="categoryTreeItems"
          :get-key="(item) => item.value"
          @update:model-value="onCategoryTreeSelect"
          @update:expanded="onCategoryTreeExpandedUpdate"
        >
          <template #item-wrapper="{ item, expanded, handleToggle }">
            <div
              :class="[
                'relative group w-full flex items-center text-sm select-none before:absolute before:inset-y-px before:inset-x-0 before:z-[-1] before:rounded-md',
                'focus:outline-none focus-visible:outline-none focus-visible:before:ring-inset focus-visible:before:ring-2 focus-visible:before:ring-primary',
                'px-2.5 py-1.5 gap-1.5 transition-colors before:transition-colors',
                selectedCategory === item.value || (!selectedCategory && item.value === '__all__')
                  ? 'before:bg-elevated text-primary'
                  : 'hover:text-highlighted hover:before:bg-elevated/50'
              ]"
              @click="onCategoryTreeSelect(item)"
            >
              <UIcon
                :name="item.icon || (item.children?.length ? (expanded ? 'i-lucide-folder-open' : 'i-lucide-folder') : 'i-lucide-folder')"
                class="size-5 shrink-0 relative"
              />
              <span class="truncate">{{ item.label }}</span>
              <span
                v-if="item.children?.length"
                class="ms-auto inline-flex gap-1.5 items-center"
              >
                <button
                  type="button"
                  class="inline-flex items-center justify-center text-(--ui-text-toned) hover:text-highlighted"
                  @click.stop="toggleCategoryTreeNode(handleToggle)"
                >
                  <UIcon
                    name="i-lucide-chevron-down"
                    :class="[
                      'size-5 shrink-0 transform transition-transform duration-200',
                      expanded ? 'rotate-180' : ''
                    ]"
                  />
                </button>
              </span>
            </div>
          </template>
        </UTree>
      </UCard>

      <div class="flex flex-col gap-3 min-w-0">
        <div class="flex flex-col gap-3">
          <div class="w-full">
            <div class="flex items-center justify-between gap-2 rounded-lg border border-(--ui-border) bg-(--ui-bg-elevated) px-3 py-2">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge
                  v-if="selectedCategory"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-folder"
                  class="cursor-pointer"
                  @click="clearCategoryFilter"
                >
                  {{ selectedCategoryName }}
                </UBadge>
                <UBadge
                  v-if="activeTag"
                  color="primary"
                  variant="subtle"
                  icon="i-lucide-tag"
                  class="cursor-pointer"
                  @click="clearTagFilter"
                >
                  {{ activeTag }}
                </UBadge>
                <UBadge
                  v-if="searchQuery.trim()"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-search"
                  class="cursor-pointer"
                  @click="clearKeywordFilter"
                >
                  {{ searchQuery.trim() }}
                </UBadge>
                <UBadge
                  v-if="sortBy !== 'hot'"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-arrow-up-down"
                  class="cursor-pointer"
                  @click="clearSortFilter"
                >
                  {{ sortLabel }}
                </UBadge>
                <span
                  v-if="!hasAnyFilter"
                  class="text-sm text-(--ui-text-muted)"
                >
                  {{ t('resources.filter_none') }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <UButton
                  v-if="auth.isLoggedIn.value"
                  color="primary"
                  icon="i-lucide-upload"
                  @click="handleUpload"
                >
                  {{ t('resources.upload') }}
                </UButton>
                <UPopover>
                  <UButton
                    color="primary"
                    variant="outline"
                    icon="i-lucide-filter"
                    class="transition-colors hover:bg-primary/10"
                  >
                    {{ t('resources.filters') }}
                  </UButton>
                  <template #content>
                    <div class="w-80 space-y-3 p-3">
                      <UFormField :label="t('resources.search_placeholder')">
                        <UInput
                          v-model="searchQuery"
                          icon="i-lucide-search"
                          :placeholder="t('resources.search_placeholder')"
                        />
                      </UFormField>
                      <UFormField :label="t('resources.sort_by')">
                        <USelect
                          v-model="sortBy"
                          :items="sortOptions"
                          option-attribute="label"
                          value-attribute="value"
                        />
                      </UFormField>
                      <UFormField :label="t('resources.filter_tag')">
                        <UInput
                          v-model="pendingTag"
                          icon="i-lucide-tag"
                          :placeholder="t('resources.filter_tag_placeholder')"
                          @blur="setTagFilter"
                          @keyup.enter="setTagFilter"
                        />
                      </UFormField>
                      <div class="flex justify-end">
                        <UButton
                          color="neutral"
                          variant="outline"
                          @click="clearAllFilters"
                        >
                          {{ t('resources.clear_filters') }}
                        </UButton>
                      </div>
                    </div>
                  </template>
                </UPopover>
              </div>
            </div>
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
            @click="router.push(`/resources/${res.id}`)"
            @pointermove="handlePointerMove"
          >
            <div
              class="relative z-10 rounded-md overflow-hidden bg-(--ui-bg-elevated) border border-(--ui-border)"
              :style="{ aspectRatio: aspectRatioStyle(res.cardAspectRatio) }"
            >
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
              <div class="mt-2 text-xs text-muted">
                {{ res.categoryKey }}
              </div>
            </div>

            <div class="relative z-10 mt-3 flex flex-wrap gap-2">
              <UBadge
                v-for="tag in res.tags"
                :key="tag"
                variant="subtle"
                color="primary"
                class="cursor-pointer"
                @click.stop="router.push({ path: '/resources', query: { ...route.query, tag } })"
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
              <div class="flex items-center gap-1">
                <UIcon name="i-lucide-star" />
                <span>{{ Number(res.ratingScore || 0).toFixed(1) }}</span>
                <span>({{ res.reviewCount || 0 }})</span>
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
            @click="router.push(`/resources/${res.id}`)"
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
                <div class="mt-2 text-xs text-muted">
                  {{ res.categoryKey }}
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
                  <div class="flex items-center gap-1">
                    <UIcon name="i-lucide-star" />
                    <span>{{ Number(res.ratingScore || 0).toFixed(1) }}</span>
                    <span>({{ res.reviewCount || 0 }})</span>
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
            :page-count="pageSize"
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
