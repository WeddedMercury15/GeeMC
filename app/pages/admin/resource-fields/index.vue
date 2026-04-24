<script setup lang="ts">
const { t } = useI18n()

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
  ssr: false
})

useHead({
  title: () => t('admin.resource_fields_page.title')
})

type Category = { id: number, name: string }
type Field = {
  id: string
  title: string
  description: string
  displayGroup: string
  displayOrder: number
  fieldType: string
  fieldChoices: Record<string, string>
  required: boolean
  maxLength: number
  viewableResource: boolean
  categoryIds: number[]
}

type ManageResp = { success: boolean, error?: string }

const { data, refresh } = await useFetch<{ categories: Category[], fields: Field[] }>('/api/admin/resource-fields/page')
const categories = computed(() => data.value?.categories ?? [])
const fields = computed(() => data.value?.fields ?? [])

const isOpen = ref(false)
const editing = ref<Field | null>(null)

const form = reactive<Field>({
  id: '',
  title: '',
  description: '',
  displayGroup: 'above_info',
  displayOrder: 1,
  fieldType: 'textbox',
  fieldChoices: {},
  required: false,
  maxLength: 0,
  viewableResource: true,
  categoryIds: []
})

function resetForm() {
  form.id = ''
  form.title = ''
  form.description = ''
  form.displayGroup = 'above_info'
  form.displayOrder = 1
  form.fieldType = 'textbox'
  form.fieldChoices = {}
  form.required = false
  form.maxLength = 0
  form.viewableResource = true
  form.categoryIds = []
  editing.value = null
}

function openCreate() {
  resetForm()
  isOpen.value = true
}

function openEdit(f: Field) {
  editing.value = f
  form.id = f.id
  form.title = f.title
  form.description = f.description
  form.displayGroup = f.displayGroup
  form.displayOrder = f.displayOrder
  form.fieldType = f.fieldType
  form.fieldChoices = { ...(f.fieldChoices ?? {}) }
  form.required = f.required
  form.maxLength = f.maxLength
  form.viewableResource = f.viewableResource
  form.categoryIds = [...f.categoryIds]
  isOpen.value = true
}

const choicesText = computed({
  get: () => Object.entries(form.fieldChoices).map(([k, v]) => `${k}:${v}`).join('\n'),
  set: (raw: string) => {
    const out: Record<string, string> = {}
    raw.split('\n').map(x => x.trim()).filter(Boolean).forEach((line) => {
      const idx = line.indexOf(':')
      if (idx === -1) return
      const k = line.slice(0, idx).trim()
      const v = line.slice(idx + 1).trim()
      if (k) out[k] = v || k
    })
    form.fieldChoices = out
  }
})

async function save() {
  const body = editing.value
    ? { intent: 'update', fieldId: editing.value.id, data: { ...form } }
    : { intent: 'create', data: { ...form } }
  const res = await $fetch<ManageResp>('/api/admin/resource-fields/manage', { method: 'POST', body })
  if (!res.success) return
  isOpen.value = false
  await refresh()
}

async function removeField(id: string) {
  const res = await $fetch<ManageResp>('/api/admin/resource-fields/manage', {
    method: 'POST',
    body: { intent: 'delete', fieldId: id }
  })
  if (!res.success) return
  await refresh()
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">
          {{ t('admin.resource_fields_page.title') }}
        </h2>
        <p class="text-(--ui-text-muted)">
          {{ t('admin.resource_fields_page.subtitle') }}
        </p>
      </div>
      <UButton color="primary" icon="i-lucide-plus" @click="openCreate">
        {{ t('admin.resource_fields_page.add_field') }}
      </UButton>
    </div>

    <div class="grid gap-3">
      <UCard v-for="f in fields" :key="f.id">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-semibold">{{ f.title }}</div>
            <div class="text-xs text-muted font-mono">{{ f.id }} · {{ f.displayGroup }} · {{ f.fieldType }}</div>
            <div class="text-xs text-muted mt-1">
              {{ categories.filter(c => f.categoryIds.includes(c.id)).map(c => c.name).join(' / ') || '-' }}
            </div>
          </div>
          <div class="flex gap-2">
            <UButton color="neutral" variant="ghost" icon="i-lucide-pencil" @click="openEdit(f)" />
            <UButton color="error" variant="ghost" icon="i-lucide-trash-2" @click="removeField(f.id)" />
          </div>
        </div>
      </UCard>
    </div>

    <UModal v-model:open="isOpen" :title="editing ? t('admin.resource_fields_page.edit_field') : t('admin.resource_fields_page.add_field')">
      <template #content>
        <div class="p-4 space-y-3">
          <UFormField :label="t('admin.resource_fields_page.field_id')">
            <UInput v-model="form.id" class="font-mono" :disabled="!!editing" />
          </UFormField>
          <UFormField :label="t('admin.resource_fields_page.field_title')">
            <UInput v-model="form.title" />
          </UFormField>
          <UFormField :label="t('admin.resource_fields_page.field_desc')">
            <UTextarea v-model="form.description" />
          </UFormField>
          <UFormField :label="t('admin.resource_fields_page.field_group')">
            <UInput v-model="form.displayGroup" class="font-mono" />
          </UFormField>
          <UFormField :label="t('admin.resource_fields_page.field_type')">
            <UInput v-model="form.fieldType" class="font-mono" />
          </UFormField>
          <UFormField :label="t('admin.resource_fields_page.field_choices')">
            <UTextarea v-model="choicesText" :placeholder="`key:Label`" />
          </UFormField>
          <div class="grid grid-cols-2 gap-2">
            <UFormField :label="t('admin.resource_fields_page.field_order')">
              <UInput v-model.number="form.displayOrder" type="number" />
            </UFormField>
            <UFormField :label="t('admin.resource_fields_page.field_max')">
              <UInput v-model.number="form.maxLength" type="number" />
            </UFormField>
          </div>
          <UCheckbox v-model="form.required" :label="t('admin.resource_fields_page.field_required')" />
          <UCheckbox v-model="form.viewableResource" :label="t('admin.resource_fields_page.field_viewable')" />
          <UFormField :label="t('admin.resource_fields_page.field_categories')">
            <USelectMenu
              v-model="form.categoryIds"
              :items="categories.map(c => ({ label: c.name, value: c.id }))"
              multiple
              value-key="value"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" @click="save">{{ t('common.save') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
