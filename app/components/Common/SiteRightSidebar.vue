<script setup lang="ts">
const { t } = useI18n()
const { formatTime } = useFormatTime()

type HotTopic = {
  id: number
  title: string
  category: string
  replies: number
  views: number
  publishDate: string
}

type Announcement = {
  id: number
  type: 'primary' | 'warning' | 'success'
  typeLabel: string
  title: string
  date: string
}

type LatestPost = {
  id: number
  title: string
  category: string
  replies: number
  views: number
  time: string
  avatar: string
}

type ForumStats = {
  totalThreads: number
  totalPosts: number
  totalMembers: number
  latestMember?: {
    id?: number
    name: string
  } | null
}

withDefaults(
  defineProps<{
    variant?: 'home' | 'forum'
    hotTopics?: HotTopic[]
    announcements?: Announcement[]
    latestPosts?: LatestPost[]
    forumStats: ForumStats
  }>(),
  {
    variant: 'home',
    hotTopics: () => [],
    announcements: () => [],
    latestPosts: () => []
  }
)
</script>

<template>
  <div class="space-y-6">
    <div v-if="variant === 'home'">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold">
          {{ t('home.sidebar_hot_title') }}
        </h2>
        <UButton
          to="/forum"
          color="neutral"
          variant="ghost"
          trailing-icon="i-lucide-chevron-right"
        >
          {{ t('home.sidebar_forum_link') }}
        </UButton>
      </div>

      <UCard :ui="{ body: '!p-0' }">
        <UEmpty
          v-if="hotTopics.length === 0"
          class="py-8 px-4"
          icon="i-lucide-flame"
          :description="t('home.sidebar_hot_empty')"
        />
        <div
          v-else
          class="flex flex-col divide-y divide-(--ui-border)"
        >
          <div
            v-for="(topic, idx) in hotTopics"
            :key="topic.id"
            class="px-4 py-3"
          >
            <div class="flex gap-3">
              <div
                class="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0"
                :class="[idx < 3 ? 'bg-primary text-white' : 'bg-(--ui-bg-elevated) text-muted']"
              >
                {{ idx + 1 }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold truncate">
                  {{ topic.title }}
                </div>
                <div class="mt-1 text-xs text-muted flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded bg-primary/10 text-primary">
                    {{ topic.category }}
                  </span>
                  <span class="ml-auto">
                    {{ formatTime(topic.publishDate) }}
                  </span>
                </div>
                <div class="mt-1 text-xs text-muted flex items-center gap-3">
                  <span class="inline-flex items-center gap-1">
                    <UIcon name="i-lucide-message-square" />
                    {{ topic.replies }}
                  </span>
                  <span class="inline-flex items-center gap-1">
                    <UIcon name="i-lucide-eye" />
                    {{ topic.views }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <div v-else>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold">
          {{ t('forum.latest_threads') }}
        </h2>
      </div>

      <UCard :ui="{ body: '!p-0' }">
        <UEmpty
          v-if="latestPosts.length === 0"
          class="py-8 px-4"
          icon="i-lucide-message-square-text"
          :description="t('forum.latest_empty')"
        />
        <div
          v-else
          class="flex flex-col divide-y divide-(--ui-border)"
        >
          <div
            v-for="p in latestPosts"
            :key="p.id"
            class="px-4 py-3"
          >
            <div class="flex gap-3">
              <UAvatar
                :src="p.avatar"
                size="sm"
                class="shrink-0"
              />
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold line-clamp-2">
                  {{ p.title }}
                </div>
                <div class="mt-1 text-xs text-muted flex items-center gap-2 flex-wrap">
                  <span class="px-2 py-0.5 rounded bg-primary/10 text-primary">
                    {{ p.category }}
                  </span>
                  <span class="ml-auto">
                    {{ formatTime(p.time) }}
                  </span>
                </div>
                <div class="mt-1 text-xs text-muted flex items-center gap-3">
                  <span class="inline-flex items-center gap-1">
                    <UIcon name="i-lucide-message-square" />
                    {{ p.replies }}
                  </span>
                  <span class="inline-flex items-center gap-1">
                    <UIcon name="i-lucide-eye" />
                    {{ p.views }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <div v-if="variant === 'home'">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold">
          {{ t('home.sidebar_announce_title') }}
        </h2>
      </div>

      <UCard :ui="{ body: '!p-0' }">
        <UEmpty
          v-if="announcements.length === 0"
          class="py-8 px-4"
          icon="i-lucide-megaphone"
          :description="t('home.sidebar_announce_empty')"
        />
        <div
          v-else
          class="flex flex-col divide-y divide-(--ui-border)"
        >
          <div
            v-for="a in announcements"
            :key="a.id"
            class="px-4 py-3 flex items-center gap-2"
          >
            <UBadge
              :color="a.type === 'primary' ? 'primary' : a.type === 'warning' ? 'warning' : 'success'"
              variant="subtle"
              class="shrink-0"
            >
              {{ a.typeLabel }}
            </UBadge>
            <div class="text-sm truncate flex-1">
              {{ a.title }}
            </div>
            <div class="text-xs text-muted shrink-0">
              {{ formatTime(a.date) }}
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <HomeForumStatsWidget :stats="forumStats" />
  </div>
</template>
