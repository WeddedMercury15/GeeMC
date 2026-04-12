<script setup lang="ts">
import type { AuthUser } from '~/composables/useAuth'

defineOptions({
  inheritAttrs: false
})

const props = withDefaults(defineProps<{
  user: Pick<AuthUser, 'username' | 'avatar'>
  size?: '3xs' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  class?: string | string[] | Record<string, boolean>
}>(), {
  size: 'md'
})

const src = computed(() => props.user.avatar || undefined)
</script>

<template>
  <UAvatar
    :src="src"
    :alt="user.username || 'User'"
    :size="size"
    :class="props.class"
    :ui="{ root: 'rounded-full' }"
    v-bind="$attrs"
  />
</template>
