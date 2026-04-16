<script setup lang="ts">
const props = defineProps<{
  initialData?: {
    id?: number
    name: string
    slug?: string
    description?: string
    isSystemDefault?: boolean
    permissions?: string[] | string | null
  }
  allPermissionKeys?: readonly string[]
  operatorPermissions?: string[]
  isSubmitting?: boolean
  isEdit?: boolean
}>()

const emit = defineEmits(['submit', 'cancel'])
const { t } = useI18n()

function parsePermissions(perms: string[] | string | null | undefined): string[] {
  if (!perms) return []
  if (Array.isArray(perms)) return perms
  try {
    return JSON.parse(perms)
  } catch {
    return []
  }
}

const form = ref({
  name: props.initialData?.name || '',
  slug: props.initialData?.slug || '',
  description: props.initialData?.description || '',
  permissions: parsePermissions(props.initialData?.permissions)
})

const isSystemDefault = computed(() => !!props.initialData?.isSystemDefault)
const isSuperAdmin = computed(() => props.initialData?.slug === 'super_admin')

const operatorPermSet = computed(() => new Set(props.operatorPermissions || []))

function canGrantPermission(key: string): boolean {
  return operatorPermSet.value.has(key)
}

function handleSubmit() {
  emit('submit', { ...form.value, id: props.initialData?.id })
}

function togglePermission(key: string) {
  const idx = form.value.permissions.indexOf(key)
  if (idx >= 0) form.value.permissions.splice(idx, 1)
  else form.value.permissions.push(key)
}
</script>

<template>
  <UForm :state="form" class="space-y-4" @submit="handleSubmit">
    <UFormField :label="t('AdminGroups.groupName')" name="name" required>
      <UInput v-model="form.name" :placeholder="t('AdminGroups.groupName')" class="w-full" />
    </UFormField>

    <UFormField
      :label="t('AdminGroups.slug')"
      name="slug"
      :description="isSystemDefault ? t('AdminGroups.slugLockedDesc') : t('AdminGroups.slugFormatDesc')"
    >
      <UInput
        v-model="form.slug"
        :placeholder="t('AdminGroups.slugPlaceholder')"
        class="w-full"
        :disabled="isSystemDefault"
      />
    </UFormField>

    <UFormField :label="t('AdminGroups.groupDesc')" name="description">
      <UTextarea v-model="form.description" :placeholder="t('AdminGroups.groupDesc')" class="w-full" />
    </UFormField>

    <UFormField
      v-if="allPermissionKeys && allPermissionKeys.length > 0"
      :label="t('AdminGroups.permissions')"
      name="permissions"
      :description="isSuperAdmin ? t('AdminGroups.superAdminPermDesc') : undefined"
    >
      <div class="space-y-2">
        <UCheckbox
          v-for="key in allPermissionKeys"
          :key="key"
          :model-value="isSuperAdmin || form.permissions.includes(key)"
          :disabled="isSuperAdmin || !canGrantPermission(key)"
          :label="t(`AdminGroups.permLabels.${key}`)"
          :description="!canGrantPermission(key) && !isSuperAdmin ? `${key} — ${t('AdminGroups.permNotGrantable')}` : key"
          @update:model-value="togglePermission(key)"
        />
      </div>
    </UFormField>

    <div class="flex justify-end gap-3 pt-4">
      <UButton color="neutral" variant="ghost" @click="emit('cancel')">
        {{ t('common.cancel') }}
      </UButton>
      <UButton type="submit" :loading="props.isSubmitting">
        {{ props.isEdit ? t('common.save') : t('common.confirm') }}
      </UButton>
    </div>
  </UForm>
</template>
