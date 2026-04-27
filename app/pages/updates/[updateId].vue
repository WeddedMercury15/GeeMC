<script setup lang="ts">
const route = useRoute()
const updateId = computed(() => String(route.params.updateId || ''))

const locate = await $fetch<{
  resourceId: string
  resourceCategoryKey: string
  tab: string
  anchor: string
}>(`/api/resources/updates/${updateId.value}/locate`)

await navigateTo(
  `/resources/${locate.resourceId}?tab=${encodeURIComponent(locate.tab)}#${locate.anchor}`,
  { replace: true }
)
</script>

<template>
  <div />
</template>
