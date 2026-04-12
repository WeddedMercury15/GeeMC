<script setup lang="ts">
const { t } = useI18n()

defineProps<{
  stats: {
    totalThreads: number
    totalPosts: number
    totalMembers: number
    latestMember?: {
      id?: number
      name: string
    } | null
  }
}>()

const formatNumber = (num: number) => new Intl.NumberFormat().format(num || 0)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold">
        {{ t('forum.stats_title') }}
      </h2>
    </div>

    <UCard :ui="{ body: '!p-0' }">
      <div class="flex flex-col divide-y divide-(--ui-border)">
        <div class="px-4 py-3 flex items-center justify-between text-sm">
          <span class="text-muted">{{ t('forum.stat_threads') }}</span>
          <span class="font-medium tabular-nums">{{ formatNumber(stats.totalThreads) }}</span>
        </div>
        <div class="px-4 py-3 flex items-center justify-between text-sm">
          <span class="text-muted">{{ t('forum.stat_posts') }}</span>
          <span class="font-medium tabular-nums">{{ formatNumber(stats.totalPosts) }}</span>
        </div>
        <div class="px-4 py-3 flex items-center justify-between text-sm">
          <span class="text-muted">{{ t('forum.stat_members') }}</span>
          <span class="font-medium tabular-nums">{{ formatNumber(stats.totalMembers) }}</span>
        </div>
        <div
          v-if="stats.latestMember"
          class="px-4 py-3 flex items-center justify-between text-sm"
        >
          <span class="text-muted shrink-0 mr-2">{{ t('forum.stat_latest_member') }}</span>
          <span class="font-medium text-primary truncate">{{ stats.latestMember.name }}</span>
        </div>
      </div>
    </UCard>
  </div>
</template>
