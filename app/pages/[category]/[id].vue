<script setup lang="ts">
import type { ResourceDetail, ResourceVersion } from '~/utils/resourceCatalog'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()
const { formatTime } = useFormatTime()

const id = computed(() => String(route.params.id || ''))

const { data: resourceData, error: resourceError } = await useAsyncData(
  () => `resource-${route.params.category}-${id.value}`,
  () => $fetch<ResourceDetail>(`/api/resources/${id.value}`)
)

if (resourceError.value || !resourceData.value) {
  throw createError({ statusCode: 404, statusMessage: 'Resource Not Found' })
}

const resource = computed(() => resourceData.value!)

const tabItems = computed(() => [
  { label: t('resources.tab_description'), value: 'description' },
  { label: t('resources.tab_gallery'), value: 'gallery' },
  { label: t('resources.tab_versions'), value: 'versions' },
  { label: t('resources.tab_changelog'), value: 'changelog' },
  { label: t('resources.tab_reviews', { count: resource.value.reviews.length }), value: 'reviews' }
])

const versionTypeItems = computed(() => [
  { label: t('resources.version_type_all'), value: 'all' },
  { label: t('resources.version_type_release'), value: 'release' },
  { label: t('resources.version_type_snapshot'), value: 'snapshot' }
])

const versionTypeLabel = (type: 'release' | 'snapshot') =>
  type === 'release' ? t('resources.version_type_release') : t('resources.version_type_snapshot')

const activeTab = ref<'description' | 'gallery' | 'versions' | 'changelog' | 'reviews'>('description')

const versionType = ref<'all' | 'release' | 'snapshot'>('all')
const filterGameVersion = ref<string>('')
const filterLoader = ref<string>('')
const filterServerType = ref<string>('')

const isFollowed = ref(false)
const downloadModalOpen = ref(false)

const quickGameVersion = ref('')
const quickLoader = ref('')
const quickServerType = ref('')

const availableGameVersions = computed(() => {
  const s = new Set<string>()
  resource.value?.versions.forEach(v => v.gameVersions?.forEach(g => s.add(g)))
  return Array.from(s).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
})

const availableLoaders = computed(() => {
  const s = new Set<string>()
  resource.value?.versions.forEach(v => v.loaders?.forEach(l => s.add(l)))
  return Array.from(s)
})

const availableServers = computed(() => {
  const s = new Set<string>()
  resource.value?.versions.forEach(v => v.serverTypes?.forEach(t => s.add(t)))
  return Array.from(s)
})

const filteredVersions = computed(() => {
  let list = [...(resource.value?.versions || [])]

  if (versionType.value !== 'all') list = list.filter(v => v.type === versionType.value)
  if (filterGameVersion.value) list = list.filter(v => v.gameVersions?.includes(filterGameVersion.value))
  if (resource.value?.categoryKey === 'mods' && filterLoader.value) list = list.filter(v => v.loaders?.includes(filterLoader.value))
  if (resource.value?.categoryKey === 'plugins' && filterServerType.value) list = list.filter(v => v.serverTypes?.includes(filterServerType.value))

  return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})

const isAllFieldsSelected = computed(() => {
  if (!quickGameVersion.value) return false
  if (resource.value?.categoryKey === 'mods' && !quickLoader.value) return false
  if (resource.value?.categoryKey === 'plugins' && !quickServerType.value) return false
  return true
})

const quickTargetVersion = computed<ResourceVersion | null>(() => {
  if (!resource.value) return null
  if (!isAllFieldsSelected.value) return null

  let list = resource.value.versions.filter(v => v.gameVersions?.includes(quickGameVersion.value))
  if (resource.value.categoryKey === 'mods') list = list.filter(v => v.loaders?.includes(quickLoader.value))
  if (resource.value.categoryKey === 'plugins') list = list.filter(v => v.serverTypes?.includes(quickServerType.value))
  if (list.length === 0) return null

  return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]!
})

const handleDownloadClick = () => {
  downloadModalOpen.value = true
}

const downloadFile = (v: ResourceVersion) => {
  toast.add({ title: t('resources.download_toast_title'), description: `${v.name}`, color: 'primary' })
}

const copyHash = async (hash: string) => {
  try {
    await navigator.clipboard.writeText(hash)
    toast.add({ title: t('common.hash_copied'), color: 'success' })
  } catch {
    toast.add({
      title: t('common.copy_failed'),
      description: t('common.copy_failed_clipboard'),
      color: 'error'
    })
  }
}

const scrollToDownloads = () => {
  activeTab.value = 'versions'
  nextTick(() => {
    document.getElementById('downloads-section')?.scrollIntoView({ behavior: 'smooth' })
  })
}

useSeoMeta({
  title: () =>
    resource.value?.title
      ? t('resources.detail_page_title', { title: resource.value.title })
      : t('common.site_name'),
  description: () => resource.value?.description || ''
})
</script>

<template>
  <UContainer class="py-6">
    <div class="flex items-center gap-2 text-sm text-muted mb-4">
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        @click="router.back()"
      >
        {{ t('resources.back') }}
      </UButton>
      <span>/</span>
      <NuxtLink
        to="/resources"
        class="hover:underline"
      >
        {{ t('resources.breadcrumb_resources') }}
      </NuxtLink>
      <span>/</span>
      <span class="text-(--ui-text)">{{ resource!.categoryLabel }}</span>
    </div>

    <UCard class="overflow-hidden">
      <div class="relative">
        <div
          class="absolute inset-0 bg-cover bg-center blur-sm scale-110 opacity-40"
          :style="{ backgroundImage: `url(${resource!.cover})` }"
        />
        <div class="relative p-6 md:p-8">
          <div class="flex flex-col md:flex-row md:items-end gap-6">
            <div class="w-24 h-24 rounded-2xl overflow-hidden border border-(--ui-border) bg-(--ui-bg-elevated) shrink-0">
              <img
                :src="resource!.icon"
                :alt="resource!.title"
                class="w-full h-full object-cover"
              >
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap gap-2 mb-2">
                <UBadge
                  color="primary"
                  variant="subtle"
                >
                  {{ resource!.categoryLabel }}
                </UBadge>
                <UBadge
                  color="success"
                  variant="subtle"
                >
                  {{ resource!.platformLabel }}
                </UBadge>
              </div>
              <h1 class="text-2xl md:text-3xl font-black tracking-tight truncate">
                {{ resource!.title }}
              </h1>
              <div class="mt-2 flex items-center gap-2 text-sm text-muted">
                <UAvatar
                  :src="resource!.authorAvatar"
                  size="2xs"
                />
                <span class="font-semibold text-(--ui-text)">{{ resource!.author }}</span>
                <span class="opacity-50">·</span>
                <span>{{ t('resources.last_updated', { time: formatTime(resource!.updateDate) }) }}</span>
              </div>
              <p class="mt-3 text-sm text-muted line-clamp-2">
                {{ resource!.description }}
              </p>
            </div>

            <div class="w-full md:w-72">
              <div class="grid grid-cols-2 gap-3 mb-3">
                <UCard
                  class="text-center"
                  :ui="{ body: 'py-3' }"
                >
                  <div class="text-lg font-bold">
                    {{ resource!.downloads }}
                  </div>
                  <div class="text-xs text-muted">
                    {{ t('resources.stat_downloads') }}
                  </div>
                </UCard>
                <UCard
                  class="text-center"
                  :ui="{ body: 'py-3' }"
                >
                  <div class="text-lg font-bold">
                    {{ resource!.followers }}
                  </div>
                  <div class="text-xs text-muted">
                    {{ t('resources.stat_followers') }}
                  </div>
                </UCard>
              </div>

              <div class="flex flex-col gap-2">
                <UButton
                  color="primary"
                  size="lg"
                  icon="i-lucide-download"
                  @click="handleDownloadClick"
                >
                  {{ t('resources.download_now') }}
                </UButton>
                <UButton
                  color="neutral"
                  variant="outline"
                  size="lg"
                  :icon="isFollowed ? 'i-lucide-heart' : 'i-lucide-heart'"
                  @click="isFollowed = !isFollowed"
                >
                  {{ isFollowed ? t('resources.following') : t('resources.follow') }}
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <div class="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-9">
        <UCard>
          <UTabs
            v-model="activeTab"
            :items="tabItems"
          >
            <template #content="{ item }">
              <div
                v-if="item.value === 'description'"
                class="prose dark:prose-invert max-w-none"
              >
                <div v-html="resource!.descriptionHtml" />
              </div>

              <div v-else-if="item.value === 'gallery'">
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <UCard
                    v-for="(img, idx) in resource!.gallery"
                    :key="idx"
                    class="overflow-hidden"
                  >
                    <div class="aspect-[16/10] rounded-md overflow-hidden bg-(--ui-bg-elevated) border border-(--ui-border)">
                      <img
                        :src="img.url"
                        :alt="img.caption"
                        class="w-full h-full object-cover"
                      >
                    </div>
                    <div class="mt-2 text-sm text-muted">
                      {{ img.caption }}
                    </div>
                  </UCard>
                </div>
              </div>

              <div v-else-if="item.value === 'versions'">
                <div
                  id="downloads-section"
                  class="flex flex-col gap-4"
                >
                  <UCard :ui="{ body: 'p-4' }">
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div class="md:col-span-4">
                        <div class="text-xs text-muted mb-1">
                          {{ t('resources.filter_game_version') }}
                        </div>
                        <USelect
                          v-model="filterGameVersion"
                          :items="availableGameVersions"
                          :placeholder="t('resources.placeholder_supported_game_versions')"
                        />
                      </div>

                      <div
                        v-if="resource!.categoryKey === 'mods'"
                        class="md:col-span-4"
                      >
                        <div class="text-xs text-muted mb-1">
                          {{ t('resources.filter_mod_loader') }}
                        </div>
                        <USelect
                          v-model="filterLoader"
                          :items="availableLoaders"
                          :placeholder="t('resources.placeholder_loader')"
                        />
                      </div>

                      <div
                        v-if="resource!.categoryKey === 'plugins'"
                        class="md:col-span-4"
                      >
                        <div class="text-xs text-muted mb-1">
                          {{ t('resources.filter_server_type') }}
                        </div>
                        <USelect
                          v-model="filterServerType"
                          :items="availableServers"
                          :placeholder="t('resources.placeholder_server')"
                        />
                      </div>

                      <div class="md:col-span-12">
                        <div class="text-xs text-muted mb-1">
                          {{ t('resources.filter_version_type') }}
                        </div>
                        <URadioGroup
                          v-model="versionType"
                          orientation="horizontal"
                          :items="versionTypeItems"
                        />
                      </div>
                    </div>
                  </UCard>

                  <UEmpty
                    v-if="filteredVersions.length === 0"
                    :title="t('resources.versions_filtered_empty_title')"
                    :description="t('resources.versions_filtered_empty_desc')"
                  />

                  <div
                    v-else
                    class="flex flex-col gap-2"
                  >
                    <UCard
                      v-for="v in filteredVersions"
                      :key="v.id"
                    >
                      <div class="flex flex-col md:flex-row md:items-center gap-4">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <div class="font-semibold truncate">
                              {{ v.name }}
                            </div>
                            <UBadge
                              :color="v.type === 'release' ? 'success' : 'warning'"
                              variant="subtle"
                            >
                              {{ versionTypeLabel(v.type) }}
                            </UBadge>
                          </div>
                          <div class="mt-1 text-xs text-muted flex flex-wrap gap-2">
                            <span class="inline-flex items-center gap-1">
                              <UIcon name="i-lucide-calendar" />
                              {{ formatTime(v.date) }}
                            </span>
                            <span class="inline-flex items-center gap-1">
                              <UIcon name="i-lucide-download" />
                              {{ v.downloads }}
                            </span>
                            <span class="inline-flex items-center gap-1">
                              <UIcon name="i-lucide-hard-drive" />
                              {{ v.size }}
                            </span>
                          </div>
                          <div class="mt-2 flex flex-wrap gap-2">
                            <UBadge
                              v-for="gv in v.gameVersions"
                              :key="gv"
                              color="neutral"
                              variant="subtle"
                            >
                              {{ gv }}
                            </UBadge>
                            <UBadge
                              v-for="l in (v.loaders || [])"
                              :key="l"
                              color="primary"
                              variant="subtle"
                            >
                              {{ l }}
                            </UBadge>
                            <UBadge
                              v-for="s in (v.serverTypes || [])"
                              :key="s"
                              color="primary"
                              variant="subtle"
                            >
                              {{ s }}
                            </UBadge>
                          </div>
                        </div>

                        <div class="flex items-center gap-2">
                          <UButton
                            color="neutral"
                            variant="outline"
                            icon="i-lucide-copy"
                            :disabled="!v.hash"
                            @click="v.hash && copyHash(v.hash)"
                          >
                            {{ t('resources.copy_hash') }}
                          </UButton>
                          <UButton
                            color="primary"
                            icon="i-lucide-download"
                            @click="downloadFile(v)"
                          >
                            {{ t('resources.download') }}
                          </UButton>
                        </div>
                      </div>
                    </UCard>
                  </div>
                </div>
              </div>

              <div v-else-if="item.value === 'changelog'">
                <UEmpty
                  v-if="resource!.changelogs.length === 0"
                  :title="t('resources.changelog_empty_title')"
                  :description="t('resources.changelog_empty_desc')"
                />
                <div
                  v-else
                  class="flex flex-col gap-4"
                >
                  <UCard
                    v-for="log in resource!.changelogs"
                    :key="log.version"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <div class="font-semibold">
                        {{ log.version }}
                      </div>
                      <UBadge
                        :color="log.type === 'release' ? 'success' : 'warning'"
                        variant="subtle"
                      >
                        {{ versionTypeLabel(log.type) }}
                      </UBadge>
                    </div>
                    <div class="mt-1 text-xs text-muted">
                      {{ formatTime(log.date) }}
                    </div>
                    <div
                      class="mt-3 prose dark:prose-invert max-w-none"
                      v-html="log.markdownHtml"
                    />
                  </UCard>
                </div>
              </div>

              <div v-else-if="item.value === 'reviews'">
                <UEmpty
                  v-if="resource!.reviews.length === 0"
                  :title="t('resources.reviews_empty_title')"
                  :description="t('resources.reviews_empty_desc')"
                />
                <div
                  v-else
                  class="flex flex-col gap-4"
                >
                  <UCard
                    v-for="r in resource!.reviews"
                    :key="r.id"
                  >
                    <div class="flex items-start gap-3">
                      <UAvatar :src="r.userAvatar" />
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-2">
                          <div class="font-semibold">
                            {{ r.userName }}
                          </div>
                          <div class="text-xs text-muted">
                            {{ formatTime(r.time) }}
                          </div>
                        </div>
                        <div class="mt-2 text-sm text-muted">
                          {{ r.content }}
                        </div>
                        <div class="mt-3 flex items-center gap-2 text-xs text-muted">
                          <UIcon name="i-lucide-thumbs-up" />
                          <span>{{ r.likes }}</span>
                        </div>
                      </div>
                    </div>
                  </UCard>
                </div>
              </div>
            </template>
          </UTabs>
        </UCard>
      </div>

      <div class="lg:col-span-3">
        <div class="flex flex-col gap-4">
          <UCard>
            <div class="text-sm font-semibold mb-2">
              {{ t('resources.related_links') }}
            </div>
            <div class="flex flex-col gap-2">
              <UButton
                v-for="l in resource!.links"
                :key="l.label"
                :to="l.url"
                target="_blank"
                color="neutral"
                variant="outline"
                :icon="l.icon"
                class="justify-start"
              >
                {{ l.label }}
              </UButton>
            </div>
          </UCard>

          <UCard>
            <div class="text-sm font-semibold mb-2">
              {{ t('resources.tags') }}
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="t in resource!.tags"
                :key="t"
                size="xs"
                color="neutral"
                variant="outline"
                @click="router.push({ path: '/resources', query: { tag: t } })"
              >
                {{ t }}
              </UButton>
            </div>
          </UCard>

          <UCard>
            <div class="text-sm font-semibold mb-2">
              {{ t('resources.quick_download') }}
            </div>
            <div class="flex flex-col gap-3">
              <USelect
                v-model="quickGameVersion"
                :items="availableGameVersions"
                :placeholder="t('resources.placeholder_pick_game_version')"
              />

              <USelect
                v-if="resource!.categoryKey === 'mods'"
                v-model="quickLoader"
                :items="availableLoaders"
                :placeholder="t('resources.placeholder_pick_loader')"
              />
              <USelect
                v-if="resource!.categoryKey === 'plugins'"
                v-model="quickServerType"
                :items="availableServers"
                :placeholder="t('resources.placeholder_pick_server')"
              />

              <UCard
                v-if="quickTargetVersion"
                :ui="{ body: 'p-3' }"
              >
                <div class="text-sm font-semibold">
                  {{ quickTargetVersion.name }}
                </div>
                <div class="text-xs text-muted mt-1">
                  {{ quickTargetVersion.size }} • {{ formatTime(quickTargetVersion.date) }}
                </div>
              </UCard>

              <UButton
                color="primary"
                :disabled="!quickTargetVersion"
                icon="i-lucide-download"
                @click="quickTargetVersion && downloadFile(quickTargetVersion)"
              >
                {{ t('resources.download_this_version') }}
              </UButton>

              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-mouse-pointer-click"
                @click="scrollToDownloads"
              >
                {{ t('resources.jump_version_list') }}
              </UButton>
            </div>
          </UCard>
        </div>
      </div>
    </div>

    <UModal v-model:open="downloadModalOpen">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <div class="font-semibold">
              {{ t('resources.download_title', { title: resource!.title }) }}
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              @click="downloadModalOpen = false"
            />
          </div>
        </template>

        <div class="flex flex-col gap-3">
          <UButton
            color="success"
            variant="solid"
            icon="i-lucide-monitor"
          >
            {{ t('resources.client_install_hint') }}
          </UButton>
          <USeparator :label="t('resources.or')" />
          <UButton
            color="primary"
            variant="outline"
            icon="i-lucide-arrow-down-to-line"
            @click="activeTab = 'versions'; downloadModalOpen = false"
          >
            {{ t('resources.pick_version_manual') }}
          </UButton>
        </div>
      </UCard>
    </UModal>
  </UContainer>
</template>
