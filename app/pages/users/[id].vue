<script setup lang="ts">
import { isGeeMcPrivilegedGroupName } from '~/utils/groupDisplay'

const { t } = useI18n()
const { formatTime } = useFormatTime()
const route = useRoute()

const userId = computed(() => String(route.params.id ?? ''))

const { data, error, pending } = await useAsyncData(
  () => `user-profile-${userId.value}`,
  () => $fetch<{
    user: {
      id: number
      username: string
      groups: string[]
      createdAt: string
      avatar: string
    }
  }>(`/api/users/${userId.value}`),
  { watch: [userId] }
)

const userInfo = computed(() => data.value?.user ?? null)
const failed = computed(() => !!error.value || (!pending.value && !userInfo.value))
</script>

<template>
  <UContainer class="py-6">
    <UCard>
      <div
        v-if="pending"
        class="py-10"
      >
        <USkeleton class="h-6 w-40" />
        <USkeleton class="h-4 w-72 mt-3" />
      </div>

      <UEmpty
        v-else-if="failed"
        :title="t('users.not_found_title')"
        :description="t('users.not_found_desc')"
      />

      <div
        v-else-if="userInfo"
        class="flex flex-col gap-6"
      >
        <div class="flex items-center gap-4">
          <UAvatar
            :src="userInfo.avatar"
            size="xl"
          />
          <div class="min-w-0">
            <h1 class="text-2xl font-black truncate">
              {{ userInfo.username }}
            </h1>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              <template
                v-for="g in userInfo.groups"
                :key="g"
              >
                <UBadge
                  v-if="isGeeMcPrivilegedGroupName(g)"
                  color="primary"
                  variant="solid"
                >
                  <UIcon
                    name="i-lucide-shield-check"
                    class="mr-1 h-3.5 w-3.5"
                  />
                  {{ g }}
                </UBadge>
                <UBadge
                  v-else
                  color="neutral"
                  variant="subtle"
                >
                  {{ g }}
                </UBadge>
              </template>
              <span class="inline-flex items-center gap-1">
                <UIcon name="i-lucide-calendar" />
                {{ t('users.joined') }} {{ formatTime(userInfo.createdAt) }}
              </span>
            </div>
          </div>
        </div>

        <USeparator />

        <UEmpty
          :title="t('users.empty_title')"
          :description="t('users.empty_desc')"
        />
      </div>
    </UCard>
  </UContainer>
</template>
