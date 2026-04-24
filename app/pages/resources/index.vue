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
  resourcesCount: number
}

const searchQuery = ref('')
const sortBy = ref<'hot' | 'new' | 'downloads' | 'rating' | 'reviews'>('hot')
const currentPage = ref(1)
const pageSize = ref(24)

const { data: resourcesData } = await useAsyncData(
  'resources-list',
  () => {
    const q: Record<string, string> = {}
    const ed = route.query.edition
    const kd = route.query.kind
    const cg = route.query.category
    const tg = route.query.tag
    if (typeof ed === 'string' && ed) q.edition = ed
    if (typeof kd === 'string' && kd) q.kind = kd
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
  { watch: [() => route.query.edition, () => route.query.kind, () => route.query.category, searchQuery, sortBy, currentPage, pageSize] }
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

const editionFilterItems = computed(() => [
  { value: 'all', label: t('resources.filter_edition_all') },
  { value: 'java', label: t('resources.taxonomy.edition_java') },
  { value: 'bedrock', label: t('resources.taxonomy.edition_bedrock') }
])

const editionModel = computed({
  get: () => (typeof route.query.edition === 'string' && route.query.edition ? route.query.edition : 'all'),
  set: (v: string) => {
    const q = { ...route.query } as Record<string, string | string[] | null | undefined>
    if (v && v !== 'all') q.edition = v
    else delete q.edition
    void router.push({ query: q })
  }
})

const kindInput = ref(typeof route.query.kind === 'string' ? route.query.kind : '')

watch(
  () => route.query.kind,
  (k) => {
    kindInput.value = typeof k === 'string' ? k : ''
  }
)

function applyKindFilter() {
  const q = { ...route.query } as Record<string, string | string[] | null | undefined>
  if (kindInput.value.trim()) q.kind = kindInput.value.trim()
  else delete q.kind
  void router.push({ query: q })
}

function taxonomyEditionLabel(ed: string) {
  const k = `resources.taxonomy.edition_${ed}`
  const tr = t(k)
  return tr !== k ? tr : ed
}

function taxonomyKindLabel(ed: string, kind: string) {
  const k = `resources.taxonomy.kind_${ed}_${kind}`
  const tr = t(k)
  return tr !== k ? tr : kind
}

function taxonomyEnvLabel(env: string) {
  const k = `resources.taxonomy.environment_${env}`
  const tr = t(k)
  return tr !== k ? tr : env
}

const isResourcesIndex = computed(() => route.path === '/resources')
const selectedCategory = computed(() => String(route.query.category ?? ''))
const categories = computed<ResourceCategoryItem[]>(() => resourcesData.value?.categories ?? [])

function goAllResources() {
  void router.push('/resources')
}

function goCategory(slug: string) {
  void router.push({ path: '/resources', query: { ...route.query, category: slug } })
}

const handleUpload = () => {
  if (!auth.canPublish.value) {
    toast.add({
      title: t('resources.upload_restricted_title'),
      description: t('resources.upload_restricted_desc'),
      color: 'warning'
    })
    return
  }
  void router.push('/resources/create')
}

const resources = computed<ResourceListItem[]>(() => resourcesData.value?.items ?? [])
const totalCount = computed(() => Number(resourcesData.value?.total ?? 0))
const pagedResources = computed(() => resources.value)

watch([searchQuery, sortBy, () => route.query.edition, () => route.query.kind, () => route.query.category, () => route.query.tag], () => {
  currentPage.value = 1
})

const activeTag = computed(() => (typeof route.query.tag === 'string' ? route.query.tag : ''))

const clearAllFilters = () => {
  searchQuery.value = ''
  sortBy.value = 'hot'
  const q = { ...route.query } as Record<string, string | string[] | null | undefined>
  delete q.edition
  delete q.kind
  delete q.category
  delete q.tag
  currentPage.value = 1
  void router.push({ query: q })
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
        <UButton
          color="neutral"
          :variant="isResourcesIndex && !selectedCategory ? 'soft' : 'ghost'"
          icon="i-lucide-list"
          class="justify-start w-full"
          @click="goAllResources"
        >
          {{ t('resources.sidebar_all') }}
        </UButton>

        <div class="mt-4 px-2 space-y-2">
          <div class="text-xs font-medium text-muted px-1">
            {{ t('resources.filter_edition') }}
          </div>
          <USelect
            v-model="editionModel"
            class="w-full"
            :items="editionFilterItems"
            option-attribute="label"
            value-attribute="value"
            size="sm"
          />
          <div class="text-xs font-medium text-muted px-1 pt-1">
            {{ t('resources.filter_kind') }}
          </div>
          <UInput
            v-model="kindInput"
            size="sm"
            class="w-full"
            :placeholder="t('resources.filter_kind_placeholder')"
            @blur="applyKindFilter"
            @keyup.enter="applyKindFilter"
          />
        </div>

        <UButton
          v-for="c in categories"
          :key="c.id"
          color="neutral"
          :variant="selectedCategory === c.slug ? 'soft' : 'ghost'"
          icon="i-lucide-tag"
          class="justify-start w-full mt-1"
          @click="goCategory(c.slug)"
        >
          <span class="truncate">{{ c.name }}</span>
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
              color="neutral"
              variant="outline"
              icon="i-lucide-message-square"
              @click="router.push('/resources/latest-reviews')"
            >
              {{ t('resources.latest_reviews_title') }}
            </UButton>
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-clock-3"
              @click="router.push('/resources/latest-updates')"
            >
              {{ t('resources.latest_updates_title') }}
            </UButton>
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-bell-ring"
              @click="auth.loggedIn.value ? router.push('/resources/watched-updates') : toast.add({ title: t('common.error'), description: t('resources.watched_updates_login_required'), color: 'error' })"
            >
              {{ t('resources.watched_updates_title') }}
            </UButton>
            <UButton
              color="primary"
              icon="i-lucide-upload"
              @click="handleUpload"
            >
              {{ t('resources.upload') }}
            </UButton>
          </div>
        </div>

        <div
          v-if="activeTag"
          class="flex items-center gap-2 text-sm"
        >
          <UBadge
            color="primary"
            variant="subtle"
            icon="i-lucide-tag"
          >
            {{ activeTag }}
          </UBadge>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            @click="router.push({ path: '/resources', query: { ...route.query, tag: undefined } })"
          >
            {{ t('resources.clear_tag') }}
          </UButton>
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
              <div class="flex flex-wrap gap-1 mt-2">
                <UBadge
                  color="neutral"
                  variant="outline"
                  size="xs"
                >
                  {{ taxonomyEditionLabel(res.taxonomy.edition) }}
                </UBadge>
                <UBadge
                  color="neutral"
                  variant="outline"
                  size="xs"
                >
                  {{ taxonomyKindLabel(res.taxonomy.edition, res.taxonomy.kind) }}
                </UBadge>
                <UBadge
                  color="neutral"
                  variant="outline"
                  size="xs"
                >
                  {{ taxonomyEnvLabel(res.taxonomy.environment) }}
                </UBadge>
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
                <div class="flex flex-wrap gap-1 mt-2">
                  <UBadge
                    color="neutral"
                    variant="outline"
                    size="xs"
                  >
                    {{ taxonomyEditionLabel(res.taxonomy.edition) }}
                  </UBadge>
                  <UBadge
                    color="neutral"
                    variant="outline"
                    size="xs"
                  >
                    {{ taxonomyKindLabel(res.taxonomy.edition, res.taxonomy.kind) }}
                  </UBadge>
                  <UBadge
                    color="neutral"
                    variant="outline"
                    size="xs"
                  >
                    {{ taxonomyEnvLabel(res.taxonomy.environment) }}
                  </UBadge>
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
