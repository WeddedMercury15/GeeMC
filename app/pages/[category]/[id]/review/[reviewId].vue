<script setup lang="ts">
const route = useRoute()

definePageMeta({
  path: '/resources/:id(\\d+)/review/:reviewId(\\d+)'
})

const resourceId = computed(() => String(route.params.id || ''))
const reviewId = computed(() => String(route.params.reviewId || ''))

const locate = await $fetch<{ page: number, anchor: string }>(
  `/api/resources/${resourceId.value}/reviews/${reviewId.value}/locate`,
  { query: { pageSize: 20 } }
)

await navigateTo(
  `/resources/${resourceId.value}/reviews?page=${locate.page}#${locate.anchor}`,
  { replace: true }
)
</script>

<template>
  <div />
</template>
