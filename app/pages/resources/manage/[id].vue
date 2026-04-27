<script setup lang="ts">
import type { ResourceDetail } from '~/utils/resourceCatalog'

const route = useRoute()
const auth = useAuth()

const id = computed(() => String(route.params.id || ''))

const { data, error } = await useAsyncData(
  () => `resource-manage-${id.value}`,
  () => $fetch<ResourceDetail>(`/api/resources/${id.value}`, { query: { includeDeleted: auth.canPublish.value ? '1' : '0' } })
)

if (error.value || !data.value) {
  throw createError({ statusCode: 404, statusMessage: 'Resource Not Found' })
}

const resource = computed(() => data.value!)
const uid = computed(() => Number(auth.user.value?.id ?? 0))
const isOwner = computed(() => uid.value > 0 && uid.value === Number(resource.value.authorUserId))
const isTeamMember = computed(() => {
  if (!uid.value) return false
  return (resource.value.teamMemberUserIds || []).includes(uid.value)
})

if (!(auth.canPublish.value && (isOwner.value || isTeamMember.value))) {
  throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
}

await navigateTo(`/resources/${resource.value.id}?manage=1`, { replace: true })
</script>

<template>
  <div />
</template>
