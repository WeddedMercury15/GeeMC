<script setup lang="ts">
import { isGeeMcPrivilegedGroupName } from '~/utils/groupDisplay'

export interface ProfileHeaderUser {
  id: number
  username: string
  email?: string
  groups: string[]
  createdAt: string
  seniorityDays: number
  avatar?: string | null
}

const { t } = useI18n()

defineProps<{
  user: ProfileHeaderUser
}>()
</script>

<template>
  <UCard>
    <div class="relative">
      <div
        v-if="$slots.actions"
        class="absolute right-0 top-0 z-10"
      >
        <slot name="actions" />
      </div>
      <div class="flex flex-row items-center gap-4 pr-8 sm:items-start sm:gap-6 sm:pr-10">
        <div class="relative shrink-0">
          <UAvatar
            :src="user.avatar || undefined"
            :alt="user.username"
            size="3xl"
            class="h-16 w-16 sm:h-32 sm:w-32 ring-2 ring-(--ui-border) transition-all duration-300"
            :ui="{
              root: 'rounded-full bg-(--ui-bg-accented)',
              fallback: 'text-2xl uppercase font-normal text-(--ui-text-muted) sm:text-6xl'
            }"
          />
        </div>

        <div class="min-w-0 flex-1 space-y-2 text-left">
          <div class="min-w-0">
            <p
              class="truncate text-xl font-bold tracking-tight sm:text-2xl"
              :title="user.username"
            >
              {{ user.username }}
            </p>
            <div
              v-if="user.groups?.length"
              class="mt-1 flex flex-wrap items-center gap-2"
            >
              <template
                v-for="g in user.groups"
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
            </div>
          </div>

          <p class="flex items-center gap-2 text-sm text-(--ui-text-muted)">
            <UIcon
              name="i-lucide-calendar"
              class="h-4 w-4 shrink-0"
            />
            {{ t('profile.joined_at') }}: {{ new Date(user.createdAt).toLocaleDateString() }}
          </p>
        </div>
      </div>
    </div>
  </UCard>
</template>
