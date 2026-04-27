<script setup lang="ts">
const route = useRoute()

definePageMeta({
  path: '/resources/:id(\\d+)/update/:updateId(\\d+)'
})

const resourceId = computed(() => String(route.params.id || ''))
const updateId = computed(() => String(route.params.updateId || ''))

const locate = await $fetch<{ tab: string, anchor: string }>(
  `/api/resources/${resourceId.value}/updates/${updateId.value}/locate`
)

await navigateTo(
  `/resources/${resourceId.value}?tab=${encodeURIComponent(locate.tab)}#${locate.anchor}`,
  { replace: true }
)
</script>

<template>
  <div />
</template>
