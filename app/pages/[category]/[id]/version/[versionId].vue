<script setup lang="ts">
const route = useRoute()

definePageMeta({
  path: '/resources/:id(\\d+)/version/:versionId(\\d+)'
})

const resourceId = computed(() => String(route.params.id || ''))
const versionId = computed(() => String(route.params.versionId || ''))

const locate = await $fetch<{ tab: string, anchor: string }>(
  `/api/resources/${resourceId.value}/versions/${versionId.value}/locate`
)

await navigateTo(
  `/resources/${resourceId.value}?tab=${encodeURIComponent(locate.tab)}#${locate.anchor}`,
  { replace: true }
)
</script>

<template>
  <div />
</template>
