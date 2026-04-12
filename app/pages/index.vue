<script setup lang="ts">
const { t } = useI18n()
const { formatTime } = useFormatTime()
const router = useRouter()

const { data: homeData, refresh: refreshHome } = await useFetch('/api/home', { key: 'home-dashboard' })

const searchQuery = ref('')
const searchType = ref<'all' | 'resource' | 'user' | 'post'>('all')
const searchTypeOptions = computed(() => [
  { label: t('home.search_type_all'), value: 'all' as const },
  { label: t('home.search_type_resource'), value: 'resource' as const },
  { label: t('home.search_type_user'), value: 'user' as const },
  { label: t('home.search_type_post'), value: 'post' as const }
])

const hotTags = computed(() => homeData.value?.hotSearchTags ?? [])

const ecosystemEntries = computed(() => homeData.value?.ecosystemEntries ?? [])

function ecosystemTitle(key: string) {
  switch (key) {
    case 'resource': return t('home.ecosystem_resource_title')
    case 'forum': return t('home.ecosystem_forum_title')
    case 'wiki': return t('home.ecosystem_wiki_title')
    case 'server': return t('home.ecosystem_server_title')
    default: return key
  }
}

function ecosystemDesc(key: string) {
  switch (key) {
    case 'resource': return t('home.ecosystem_resource_desc')
    case 'forum': return t('home.ecosystem_forum_desc')
    case 'wiki': return t('home.ecosystem_wiki_desc')
    case 'server': return t('home.ecosystem_server_desc')
    default: return ''
  }
}

const featuredPool = computed(() => homeData.value?.featuredResources ?? [])

type FeaturedCard = {
  id: string
  title: string
  description: string
  category: string
  categoryKey: string
  categoryLabel: string
  author: string
  authorAvatar: string
  downloads: string
  cover: string
  publishDate: string
}

const featuredResources = ref<FeaturedCard[]>([])

function syncFeaturedFromPool() {
  const pool = featuredPool.value
  if (!pool.length) {
    featuredResources.value = []
    return
  }
  featuredResources.value = pool.slice(0, 4).map((r) => {
    const ext = r as { categoryKey?: string, categoryLabel?: string }
    return {
      ...r,
      categoryKey: ext.categoryKey || 'mods',
      categoryLabel: ext.categoryLabel || r.category
    }
  })
}

watch(featuredPool, syncFeaturedFromPool, { immediate: true })

const refreshFeaturedResources = async () => {
  await refreshHome()
  const pool = featuredPool.value
  if (!pool.length) {
    featuredResources.value = []
    return
  }
  const shuffled = [...pool].sort(() => 0.5 - Math.random())
  featuredResources.value = shuffled.slice(0, 4).map((r) => {
    const ext = r as { categoryKey?: string, categoryLabel?: string }
    return {
      ...r,
      categoryKey: ext.categoryKey || 'mods',
      categoryLabel: ext.categoryLabel || r.category
    }
  })
}

const hotTopics = computed(() => homeData.value?.hotTopics ?? [])
const announcements = computed(() => homeData.value?.announcements ?? [])
const forumStats = computed(() => homeData.value?.forumStats ?? {
  totalThreads: 0,
  totalPosts: 0,
  totalMembers: 0,
  latestMember: undefined
})

const homeRightSidebarOpen = useState<boolean>('homeRightSidebarOpen', () => false)
const homeRightSidebarDesktopOpen = useState<boolean>('homeRightSidebarDesktopOpen', () => true)

const handleSearch = () => {
  if (!searchQuery.value.trim()) return
  router.push({ path: '/resources', query: { q: searchQuery.value.trim(), type: searchType.value } })
}

const handleHotTagSearch = (tag: { label: string, type: typeof searchType.value }) => {
  router.push({ path: '/resources', query: { q: tag.label, type: tag.type } })
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
  <div class="home-page">
    <CommonSidebarLayout :sidebar-open="false">
      <section class="hero-section">
        <div class="hero-bg-grid" />
        <div class="hero-bg-orbs">
          <div class="orb orb-1" />
          <div class="orb orb-2" />
          <div class="orb orb-3" />
        </div>

        <div class="relative">
          <div class="mx-auto max-w-3xl text-center">
            <div class="mb-5 flex justify-center">
              <UBadge
                color="primary"
                variant="subtle"
                class="px-3 py-1"
              >
                {{ t('home.hero_badge') }}
              </UBadge>
            </div>

            <h1 class="hero-title">
              {{ t('home.hero_title_line1') }}<br>
              {{ t('home.hero_title_line2') }}
            </h1>
            <p class="hero-subtitle">
              {{ t('home.hero_subtitle') }}
            </p>

            <UCard class="search-card">
              <div class="flex flex-col md:flex-row gap-3">
                <UInput
                  v-model="searchQuery"
                  icon="i-lucide-search"
                  size="lg"
                  class="flex-1"
                  :placeholder="t('home.search_placeholder')"
                  @keydown.enter="handleSearch"
                />
                <USelect
                  v-model="searchType"
                  :items="searchTypeOptions"
                  value-key="value"
                  label-key="label"
                  size="lg"
                  class="md:w-40"
                />
                <UButton
                  color="primary"
                  size="lg"
                  class="md:px-7"
                  @click="handleSearch"
                >
                  {{ t('home.search_button') }}
                </UButton>
              </div>

              <div
                v-if="hotTags.length"
                class="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm"
              >
                <span class="text-muted">
                  {{ t('home.hot_search') }}
                </span>
                <UButton
                  v-for="tag in hotTags"
                  :key="tag.label"
                  size="xs"
                  color="primary"
                  variant="soft"
                  @click="handleHotTagSearch(tag)"
                >
                  {{ tag.label }}
                </UButton>
              </div>
            </UCard>
          </div>
        </div>
      </section>

      <section class="eco-section">
        <div class="flex flex-wrap gap-3 justify-center">
          <UButton
            v-for="e in ecosystemEntries"
            :key="e.key"
            :to="e.to === '#' ? undefined : e.to"
            :disabled="e.to === '#'"
            color="neutral"
            variant="outline"
            class="w-full sm:w-[255px] lg:w-[215px] justify-start px-4 py-4 rounded-xl"
          >
            <div class="eco-icon">
              <UIcon
                :name="e.icon"
                class="text-lg"
              />
            </div>
            <div class="min-w-0 flex-1 text-left">
              <div class="text-sm font-semibold truncate">
                {{ ecosystemTitle(e.key) }}
              </div>
              <div class="text-xs text-muted truncate mt-0.5">
                {{ ecosystemDesc(e.key) }}
              </div>
            </div>
            <UIcon
              name="i-lucide-chevron-right"
              class="eco-arrow"
            />
          </UButton>
        </div>
      </section>

      <UContainer>
        <div
          class="pt-5 grid grid-cols-1 gap-6 items-start transition-all duration-300"
          :class="homeRightSidebarDesktopOpen ? 'lg:grid-cols-[minmax(0,1fr)_336px]' : 'lg:grid-cols-[minmax(0,1fr)_0px]'"
        >
          <div class="min-w-0">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <h2 class="text-xl font-bold">
                  {{ t('home.featured_title') }}
                </h2>
                <UBadge
                  color="primary"
                  variant="subtle"
                >
                  {{ t('home.featured_badge') }}
                </UBadge>
              </div>
              <div class="flex items-center gap-3">
                <UButton
                  color="primary"
                  variant="ghost"
                  icon="i-lucide-refresh-cw"
                  @click="refreshFeaturedResources"
                >
                  {{ t('home.refresh_batch') }}
                </UButton>
                <UButton
                  to="/resources"
                  color="neutral"
                  variant="ghost"
                  trailing-icon="i-lucide-chevron-right"
                >
                  {{ t('home.view_more') }}
                </UButton>
              </div>
            </div>

            <UEmpty
              v-if="featuredResources.length === 0"
              class="py-8"
              :description="t('home.featured_empty')"
            />

            <div
              v-else
              class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
            >
              <UCard
                v-for="res in featuredResources"
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
                  body: 'p-4 h-full flex flex-col'
                }"
                @click="router.push(`/${res.categoryKey}/${res.id}`)"
                @pointermove="handlePointerMove"
              >
                <div class="relative z-10 aspect-[16/10] rounded-md overflow-hidden border border-(--ui-border) bg-(--ui-bg-elevated)">
                  <img
                    :src="res.cover"
                    :alt="res.title"
                    class="w-full h-full object-cover"
                  >
                </div>
                <div class="relative z-10 mt-3 flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="font-semibold truncate">
                      {{ res.title }}
                    </div>
                    <div class="text-xs text-muted mt-1 line-clamp-2">
                      {{ res.description }}
                    </div>
                  </div>
                  <UBadge
                    color="warning"
                    variant="subtle"
                    class="shrink-0"
                  >
                    {{ res.categoryLabel }}
                  </UBadge>
                </div>
                <div class="relative z-10 mt-auto pt-4 flex flex-wrap items-center justify-between gap-y-2 text-xs text-muted">
                  <div class="flex items-center gap-2 min-w-0 flex-1">
                    <UAvatar
                      :src="res.authorAvatar"
                      size="2xs"
                    />
                    <span class="truncate">{{ res.author }}</span>
                  </div>
                  <div class="flex items-center gap-3 shrink-0">
                    <span class="inline-flex items-center gap-1">
                      <UIcon name="i-lucide-clock" />
                      {{ formatTime(res.publishDate) }}
                    </span>
                    <span class="inline-flex items-center gap-1">
                      <UIcon name="i-lucide-download" />
                      {{ res.downloads }}
                    </span>
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
          </div>

          <aside
            class="hidden lg:block relative overflow-hidden transition-all duration-300 ease-in-out"
            :class="homeRightSidebarDesktopOpen ? 'w-[336px] opacity-100' : 'w-0 opacity-0 pointer-events-none'"
          >
            <div
              class="w-[336px] box-border px-2 pb-3"
            >
              <div class="sticky top-[calc(var(--header-height,64px)+16px)]">
                <CommonSiteRightSidebar
                  variant="home"
                  :hot-topics="hotTopics"
                  :announcements="announcements"
                  :forum-stats="forumStats"
                />
              </div>
            </div>
          </aside>
        </div>
      </UContainer>
    </CommonSidebarLayout>

    <USlideover
      v-model:open="homeRightSidebarOpen"
      side="right"
      class="lg:hidden"
      :ui="{ content: 'w-[88vw] max-w-md h-screen overflow-y-auto' }"
    >
      <template #content>
        <div class="p-4 pt-8 pb-6 sm:px-5">
          <CommonSiteRightSidebar
            variant="home"
            :hot-topics="hotTopics"
            :announcements="announcements"
            :forum-stats="forumStats"
          />
        </div>
      </template>
    </USlideover>
  </div>
</template>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
}

.hero-section {
  position: relative;
  padding: 80px 0 60px;
  overflow: hidden;
  background: linear-gradient(160deg, color-mix(in oklab, var(--ui-primary) 18%, transparent) 0%, var(--ui-bg) 60%);
}

.hero-bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(color-mix(in oklab, var(--ui-border) 70%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in oklab, var(--ui-border) 70%, transparent) 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.35;
  pointer-events: none;
}

.hero-bg-orbs {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.orb {
  position: absolute;
  border-radius: 9999px;
  filter: blur(80px);
  opacity: 0.18;
}
.orb-1 {
  width: 420px;
  height: 420px;
  background: color-mix(in oklab, var(--ui-primary) 85%, transparent);
  top: -140px;
  left: -120px;
}
.orb-2 {
  width: 320px;
  height: 320px;
  background: #7c3aed;
  top: -90px;
  right: -120px;
}
.orb-3 {
  width: 260px;
  height: 260px;
  background: #06b6d4;
  bottom: -120px;
  left: 42%;
}

.hero-title {
  font-size: clamp(2rem, 4vw, 3.25rem);
  font-weight: 900;
  letter-spacing: -0.04em;
  line-height: 1.12;
  margin: 0 0 16px;
}

.hero-subtitle {
  font-size: 1.05rem;
  color: var(--ui-text-muted);
  margin: 0 0 24px;
  line-height: 1.7;
}

.search-card {
  box-shadow: 0 10px 40px color-mix(in oklab, var(--ui-primary) 18%, transparent);
}

.eco-section {
  background: var(--ui-bg-elevated);
  border-top: 1px solid var(--ui-border);
  border-bottom: 1px solid var(--ui-border);
  padding: 18px 0;
}

.eco-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: color-mix(in oklab, var(--ui-primary) 9%, transparent);
  color: var(--ui-primary);
}

.eco-arrow {
  opacity: 0.35;
  transform: translateX(-1px);
  transition: opacity 160ms ease, transform 160ms ease;
  color: var(--ui-text-muted);
}

button:hover .eco-arrow {
  opacity: 0.75;
  transform: translateX(2px);
}
</style>
