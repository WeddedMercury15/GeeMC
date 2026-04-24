<script setup lang="ts">
const { t } = useI18n()

type TopResource = {
  resourceId: string
  title: string
  categoryKey: string
  followersCount: number
}

type RecentFollow = {
  userId: number
  userName: string
  resourceId: string
  resourceTitle: string
  categoryKey: string
  createdAt: string
}

const { data, pending } = await useAsyncData(
  'admin-resource-followers-page',
  () => $fetch<{ topResources: TopResource[], recentFollows: RecentFollow[], totalFollows: number }>('/api/admin/resource-followers/page')
)

const topResources = computed(() => data.value?.topResources ?? [])
const recentFollows = computed(() => data.value?.recentFollows ?? [])
const totalFollows = computed(() => Number(data.value?.totalFollows ?? 0))
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-3xl font-bold tracking-tight">{{ t('admin.resource_followers_page.title') }}</h2>
      <p class="text-(--ui-text-muted)">{{ t('admin.resource_followers_page.subtitle') }}</p>
    </div>

    <UCard>
      <div class="text-sm text-(--ui-text-muted)">{{ t('admin.resource_followers_page.total', { total: totalFollows }) }}</div>
    </UCard>

    <UCard>
      <div class="text-lg font-semibold mb-3">{{ t('admin.resource_followers_page.top_resources') }}</div>
      <div v-if="pending" class="text-sm text-(--ui-text-muted)">{{ t('admin.resource_followers_page.loading') }}</div>
      <div v-else-if="topResources.length === 0" class="text-sm text-(--ui-text-muted)">{{ t('admin.resource_followers_page.empty') }}</div>
      <div v-else class="space-y-2">
        <div v-for="row in topResources" :key="row.resourceId" class="flex items-center justify-between border border-(--ui-border) rounded-lg p-3">
          <NuxtLink :to="`/${row.categoryKey}/${row.resourceId}`" class="font-medium text-(--ui-primary) hover:underline">
            {{ row.title }}
          </NuxtLink>
          <UBadge color="primary" variant="subtle">{{ row.followersCount }}</UBadge>
        </div>
      </div>
    </UCard>

    <UCard>
      <div class="text-lg font-semibold mb-3">{{ t('admin.resource_followers_page.recent_follows') }}</div>
      <div v-if="pending" class="text-sm text-(--ui-text-muted)">{{ t('admin.resource_followers_page.loading') }}</div>
      <div v-else-if="recentFollows.length === 0" class="text-sm text-(--ui-text-muted)">{{ t('admin.resource_followers_page.empty') }}</div>
      <div v-else class="space-y-2">
        <div v-for="row in recentFollows" :key="`${row.userId}-${row.resourceId}-${row.createdAt}`" class="border border-(--ui-border) rounded-lg p-3">
          <div class="text-sm">
            <span class="font-medium">{{ row.userName }}</span>
            <span class="text-(--ui-text-muted)"> {{ t('admin.resource_followers_page.followed') }} </span>
            <NuxtLink :to="`/${row.categoryKey}/${row.resourceId}`" class="text-(--ui-primary) hover:underline">
              {{ row.resourceTitle }}
            </NuxtLink>
          </div>
          <div class="text-xs text-(--ui-text-muted) mt-1">{{ row.createdAt }}</div>
        </div>
      </div>
    </UCard>
  </div>
</template>

