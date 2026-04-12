<script setup lang="ts">
const { t } = useI18n()
const { formatTime } = useFormatTime()
const toast = useToast()

const { data } = await useFetch('/api/forum', { key: 'forum-index' })

const forumCategories = computed(() => data.value?.categories ?? [])
const latestPosts = computed(() => data.value?.latestPosts ?? [])
const forumStats = computed(() => data.value?.stats ?? {
  totalThreads: 0,
  totalPosts: 0,
  totalMembers: 0,
  latestMember: null as { name: string } | null
})

const openNode = () => {
  toast.add({ title: t('common.error'), description: t('forum.thread_not_implemented'), color: 'neutral' })
}
</script>

<template>
  <UContainer class="py-6">
    <div class="flex items-center justify-between gap-3 mb-4">
      <h1 class="text-xl font-bold">
        {{ t('nav.forum') }}
      </h1>
    </div>

    <div class="grid grid-cols-1 gap-6 items-start lg:grid-cols-[minmax(0,1fr)_336px]">
      <div class="min-w-0 flex flex-col gap-4">
        <UEmpty
          v-if="forumCategories.length === 0"
          class="py-12"
          icon="i-lucide-layout-grid"
          :description="t('forum.categories_empty')"
        />

        <template v-else>
          <UCard
            v-for="cat in forumCategories"
            :key="cat.id"
          >
            <div class="flex items-center justify-between">
              <div class="text-base font-semibold">
                {{ cat.name }}
              </div>
            </div>

            <USeparator class="my-3" />

            <div class="flex flex-col divide-y divide-(--ui-border)">
              <button
                v-for="node in cat.nodes"
                :key="node.id"
                class="text-left py-4 hover:bg-(--ui-bg-elevated)/50 transition px-2 -mx-2 rounded-md"
                @click="openNode"
              >
                <div class="flex items-start gap-4">
                  <div class="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <UIcon
                      :name="node.icon"
                      class="text-xl"
                    />
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="font-semibold">
                      {{ node.title }}
                    </div>
                    <div class="text-sm text-muted mt-1">
                      {{ node.description }}
                    </div>

                    <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      <span>{{ t('forum.threads') }}：{{ node.threads }}</span>
                      <span>{{ t('forum.messages') }}：{{ node.messages }}</span>
                      <span class="inline-flex items-center gap-2">
                        <UAvatar
                          :src="node.latestPost.avatar"
                          size="2xs"
                        />
                        <span class="truncate max-w-64">{{ node.latestPost.title }}</span>
                        <span class="opacity-50">·</span>
                        <span>{{ node.latestPost.author }}</span>
                        <span class="opacity-50">·</span>
                        <span>{{ formatTime(node.latestPost.time) }}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </UCard>
        </template>
      </div>

      <aside class="w-full lg:w-[336px] box-border lg:px-2 lg:pb-3 shrink-0">
        <div class="lg:sticky lg:top-[calc(var(--header-height,64px)+16px)]">
          <CommonSiteRightSidebar
            variant="forum"
            :latest-posts="latestPosts"
            :forum-stats="forumStats"
          />
        </div>
      </aside>
    </div>
  </UContainer>
</template>
