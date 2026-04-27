<script setup lang="ts">
const route = useRoute()
const versionId = computed(() => String(route.params.versionId || ''))

const locate = await $fetch<{
  resourceId: string
  resourceCategoryKey: string
  tab: string
  anchor: string
}>(`/api/resources/versions/${versionId.value}/locate`)

await navigateTo(
  `/resources/${locate.resourceId}?tab=${encodeURIComponent(locate.tab)}#${locate.anchor}`,
  { replace: true }
)
</script>

<template>
  <div />
</template>
