<script setup lang="ts">
const route = useRoute()

const category = computed(() => String(route.params.category || ''))
const resourceId = computed(() => String(route.params.id || ''))
const versionId = computed(() => String(route.params.versionId || ''))

const locate = await $fetch<{ tab: string, anchor: string }>(
  `/api/resources/${resourceId.value}/versions/${versionId.value}/locate`
)

await navigateTo(
  `/${category.value}/${resourceId.value}?tab=${encodeURIComponent(locate.tab)}#${locate.anchor}`,
  { replace: true }
)
</script>

<template>
  <div />
</template>
