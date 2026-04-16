<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: 'admin',
  ssr: false
})

const { t } = useI18n()

useHead({
  title: () => t('admin.dashboard')
})

interface DashboardStats {
  totalUsers: { value: number, newThisMonth: number }
  userGroups: { value: number }
  activeSessions: { value: number }
  system: {
    status: string
    load: number[]
    orm: string
    database: string
    environment: string
  }
}

interface ActivityItem {
  id: number
  username: string
  avatar: string
  type: string
  timestamp: string | Date
}

const { data: statsData } = await useFetch<{ stats: DashboardStats }>('/api/admin/stats')
const { data: activityData } = await useFetch<{ activities: ActivityItem[] }>('/api/admin/activities')

const stats = computed(() => {
  const d = statsData.value?.stats ?? {} as Partial<DashboardStats>
  return [
    {
      title: t('admin.stats.total_users'),
      value: d.totalUsers?.value?.toLocaleString() ?? '0',
      description: `+${d.totalUsers?.newThisMonth ?? 0} ${t('admin.stats.from_last_month')}`,
      icon: 'i-lucide-users',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    },
    {
      title: t('admin.stats.user_groups'),
      value: d.userGroups?.value?.toLocaleString() ?? '0',
      description: t('admin.stats.groups_desc'),
      icon: 'i-lucide-shield-user',
      color: 'text-purple-500',
      bg: 'bg-purple-500/10'
    },
    {
      title: t('admin.stats.active_sessions'),
      value: d.activeSessions?.value?.toLocaleString() ?? '0',
      description: t('admin.stats.sessions_desc'),
      icon: 'i-lucide-key-round',
      color: 'text-green-500',
      bg: 'bg-green-500/10'
    },
    {
      title: t('admin.stats.system_load'),
      value:
        d.system?.status === 'High'
          ? t('admin.stats.high')
          : t('admin.stats.normal'),
      description: d.system?.load?.length
        ? `${t('admin.stats.load_label')}: ${d.system.load[0]?.toFixed(2) ?? '0.00'}, ${d.system.load[1]?.toFixed(2) ?? '0.00'}, ${d.system.load[2]?.toFixed(2) ?? '0.00'}`
        : t('admin.stats.stable'),
      icon: 'i-lucide-activity',
      color: 'text-orange-500',
      bg: 'bg-orange-500/10'
    }
  ]
})

const recentActivities = computed(() => activityData.value?.activities ?? [])

function formatTimeAgo(date: string | Date) {
  const d = new Date(date)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return t('admin.activity.time_just_now')
  if (diff < 3600) return t('admin.activity.time_minutes_ago', { n: Math.floor(diff / 60) })
  if (diff < 86400) return t('admin.activity.time_hours_ago', { n: Math.floor(diff / 3600) })
  return d.toLocaleDateString()
}
</script>

<template>
  <div class="mx-auto w-full max-w-6xl space-y-8 lg:max-w-none">
    <header class="border-b border-(--ui-border) pb-6">
      <h1 class="text-2xl font-bold tracking-tight text-(--ui-text-highlighted) sm:text-3xl">
        {{ t('admin.dashboard') }}
      </h1>
      <p class="mt-1.5 max-w-2xl text-pretty text-sm leading-relaxed text-(--ui-text-muted) sm:text-[15px]">
        {{ t('admin.dashboard_subtitle') }}
      </p>
    </header>

    <section aria-label="Statistics">
      <div
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4"
      >
        <UCard
          v-for="stat in stats"
          :key="stat.title"
          class="border border-(--ui-border) shadow-none"
          :ui="{ body: 'p-4 sm:p-5' }"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1 space-y-2">
              <p class="text-sm font-medium text-(--ui-text-muted)">
                {{ stat.title }}
              </p>
              <p class="text-2xl font-bold tabular-nums tracking-tight text-(--ui-text-highlighted)">
                {{ stat.value }}
              </p>
              <p class="text-xs leading-snug text-(--ui-text-muted) line-clamp-2">
                {{ stat.description }}
              </p>
            </div>
            <div
              :class="[stat.bg, 'flex size-11 shrink-0 items-center justify-center rounded-xl']"
            >
              <UIcon
                :name="stat.icon"
                :class="[stat.color, 'size-5']"
              />
            </div>
          </div>
        </UCard>
      </div>
    </section>

    <section
      aria-label="Details"
      class="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12"
    >
      <UCard
        class="flex min-h-[280px] flex-col border border-(--ui-border) shadow-none lg:col-span-7"
        :ui="{
          header: 'border-b border-(--ui-border) pb-4',
          body: 'flex flex-1 flex-col pt-5 min-h-0'
        }"
      >
        <template #header>
          <div class="space-y-1">
            <h2 class="text-base font-semibold tracking-tight text-(--ui-text-highlighted)">
              {{ t('admin.activity.recent') }}
            </h2>
            <p class="text-sm text-(--ui-text-muted)">
              {{ t('admin.activity.recent_desc') }}
            </p>
          </div>
        </template>

        <div
          class="flex flex-1 flex-col"
          :class="recentActivities.length === 0 ? 'justify-center' : ''"
        >
          <ul
            v-if="recentActivities.length > 0"
            class="divide-y divide-(--ui-border)/60"
          >
            <li
              v-for="activity in recentActivities"
              :key="activity.id"
              class="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
            >
              <UserAvatar
                :user="{ username: activity.username, avatar: activity.avatar }"
                class="size-10 shrink-0"
              />
              <div class="min-w-0 flex-1 space-y-0.5">
                <p class="text-sm font-medium text-(--ui-text-highlighted)">
                  {{ t('admin.activity.new_user') }}
                </p>
                <p class="truncate text-sm text-(--ui-text-muted)">
                  {{ t('admin.activity.joined', { name: activity.username }) }}
                </p>
              </div>
              <time
                class="shrink-0 text-xs tabular-nums text-(--ui-text-muted)"
                :datetime="String(activity.timestamp)"
              >
                {{ formatTimeAgo(activity.timestamp) }}
              </time>
            </li>
          </ul>
          <p
            v-else
            class="py-6 text-center text-sm text-(--ui-text-muted)"
          >
            {{ t('admin.activity.no_recent') }}
          </p>
        </div>
      </UCard>

      <UCard
        class="flex min-h-[280px] flex-col border border-(--ui-border) shadow-none lg:col-span-5"
        :ui="{
          header: 'border-b border-(--ui-border) pb-4',
          body: 'flex flex-1 flex-col justify-start pt-5'
        }"
      >
        <template #header>
          <div class="space-y-1">
            <h2 class="text-base font-semibold tracking-tight text-(--ui-text-highlighted)">
              {{ t('admin.system.title') }}
            </h2>
            <p class="text-sm text-(--ui-text-muted)">
              {{ t('admin.system.desc') }}
            </p>
          </div>
        </template>

        <dl class="space-y-4">
          <div class="flex items-center justify-between gap-4 text-sm">
            <dt class="text-(--ui-text-muted)">
              {{ t('admin.system.orm') }}
            </dt>
            <dd class="font-medium text-(--ui-text-highlighted)">
              {{ statsData?.stats?.system?.orm ?? 'Drizzle ORM' }}
            </dd>
          </div>
          <div class="flex items-start justify-between gap-4 text-sm">
            <dt class="shrink-0 text-(--ui-text-muted)">
              {{ t('admin.system.db') }}
            </dt>
            <dd class="max-w-[60%] text-right font-medium break-words text-(--ui-text-highlighted)">
              {{ statsData?.stats?.system?.database ?? 'SQLite' }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4 text-sm">
            <dt class="text-(--ui-text-muted)">
              {{ t('admin.system.env') }}
            </dt>
            <dd>
              <UBadge
                :color="statsData?.stats?.system?.environment === 'production' ? 'primary' : 'success'"
                variant="subtle"
                size="xs"
                class="uppercase"
              >
                {{ statsData?.stats?.system?.environment ?? 'development' }}
              </UBadge>
            </dd>
          </div>
        </dl>
      </UCard>
    </section>
  </div>
</template>
