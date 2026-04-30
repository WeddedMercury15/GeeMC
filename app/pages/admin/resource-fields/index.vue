<script setup lang="ts">
import type { NormalizedResourceFieldChoiceRecord } from '~/utils/resourceFieldChoices'

const { t } = useI18n()
const toast = useToast()

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
  ssr: false
})

useHead({
  title: () => t('admin.resource_fields_page.title')
})

type Category = {
  id: number
  name: string
  parentCategoryId: number
  icon?: string
}

type CategoryTreeItem = {
  label: string
  value: number
  icon?: string
  defaultExpanded?: boolean
  children?: CategoryTreeItem[]
}
type Field = {
  id: string
  title: string
  description: string
  displayGroup: string
  displayGroups: string[]
  displayOrder: number
  fieldScope: 'resource' | 'version'
  fieldType: string
  fieldChoices: NormalizedResourceFieldChoiceRecord
  matchType: string
  matchParams: Record<string, string>
  required: boolean
  maxLength: number
  versionFilterable: boolean
  viewableResource: boolean
  categoryIds: number[]
}

type ManageResp = { success: boolean, error?: string }
type ChoiceRow = { key: string, label: string, iconUrl: string }
type FieldValidationError = { path?: string, message?: string }

const { data, refresh } = await useFetch<{ categories: Category[], fields: Field[] }>('/api/admin/resource-fields/page')
const categories = computed(() => data.value?.categories ?? [])
const fields = computed(() => data.value?.fields ?? [])
const categoryPickerOpen = ref(false)
const pendingCategoryIds = ref<number[]>([])
const expandedCategoryTreeKeys = ref<string[]>([])
const categoryChevronTogglePending = ref(false)

const categoryNameById = computed(() => {
  const map = new Map<number, string>()
  for (const category of categories.value) {
    map.set(category.id, category.name)
  }
  return map
})

const categoryTreeItems = computed<CategoryTreeItem[]>(() => {
  const childrenByParent = new Map<number, Category[]>()
  for (const category of categories.value) {
    const parentId = Number(category.parentCategoryId ?? 0)
    const list = childrenByParent.get(parentId) ?? []
    list.push(category)
    childrenByParent.set(parentId, list)
  }

  const build = (parentId: number): CategoryTreeItem[] => {
    const children = (childrenByParent.get(parentId) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))
    return children.map((child) => {
      const nodes = build(child.id)
      return {
        label: child.name,
        value: child.id,
        icon: child.icon || 'i-lucide-folder',
        defaultExpanded: true,
        ...(nodes.length ? { children: nodes } : {})
      }
    })
  }

  return build(0)
})

const defaultExpandedCategoryTreeKeys = computed(() => {
  const keys: string[] = []

  const walk = (items: CategoryTreeItem[]) => {
    for (const item of items) {
      if (item.children?.length) {
        keys.push(String(item.value))
        walk(item.children)
      }
    }
  }

  walk(categoryTreeItems.value)
  return keys
})

const pendingCategoryIdSet = computed(() => new Set(pendingCategoryIds.value))

const categoryDisplayLabel = computed(() => {
  if (form.categoryIds.length === 0) return t('admin.resource_fields_page.field_categories')
  return form.categoryIds
    .map(id => categoryNameById.value.get(id))
    .filter((name): name is string => Boolean(name))
    .join(' / ')
})

const displayGroupItems = computed(() => ([
  { label: t('admin.resource_fields_page.display_group_above_info'), value: 'above_info' },
  { label: t('admin.resource_fields_page.display_group_below_info'), value: 'below_info' },
  { label: t('admin.resource_fields_page.display_group_above_rating'), value: 'above_rating' },
  { label: t('admin.resource_fields_page.display_group_below_rating'), value: 'below_rating' },
  { label: t('admin.resource_fields_page.display_group_below_sidebar_buttons'), value: 'below_sidebar_buttons' },
  { label: t('admin.resource_fields_page.display_group_sidebar'), value: 'sidebar' },
  { label: t('admin.resource_fields_page.display_group_extra_tab'), value: 'extra_tab' },
  { label: t('admin.resource_fields_page.display_group_new_tab'), value: 'new_tab' }
]))

const fieldTypeItems = computed(() => ([
  { label: t('admin.resource_fields_page.field_type_textbox'), value: 'textbox' },
  { label: t('admin.resource_fields_page.field_type_textarea'), value: 'textarea' },
  { label: t('admin.resource_fields_page.field_type_select'), value: 'select' },
  { label: t('admin.resource_fields_page.field_type_radio'), value: 'radio' },
  { label: t('admin.resource_fields_page.field_type_checkbox'), value: 'checkbox' },
  { label: t('admin.resource_fields_page.field_type_multiselect'), value: 'multiselect' }
]))

const fieldScopeItems = computed(() => ([
  { label: t('admin.resource_fields_page.field_scope_resource'), value: 'resource' },
  { label: t('admin.resource_fields_page.field_scope_version'), value: 'version' }
]))

const matchTypeItems = computed(() => ([
  { label: t('admin.resource_fields_page.match_type_none'), value: 'none' },
  { label: t('admin.resource_fields_page.match_type_number'), value: 'number' },
  { label: t('admin.resource_fields_page.match_type_alphanumeric'), value: 'alphanumeric' },
  { label: t('admin.resource_fields_page.match_type_email'), value: 'email' },
  { label: t('admin.resource_fields_page.match_type_url'), value: 'url' },
  { label: t('admin.resource_fields_page.match_type_regex'), value: 'regex' }
]))

function getDisplayGroupLabel(group: string) {
  const matched = displayGroupItems.value.find(item => item.value === group)
  return matched?.label || group
}

function getFieldTypeLabel(fieldType: string) {
  const matched = fieldTypeItems.value.find(item => item.value === fieldType)
  return matched?.label || fieldType
}

function getFieldScopeLabel(fieldScope: Field['fieldScope']) {
  const matched = fieldScopeItems.value.find(item => item.value === fieldScope)
  return matched?.label || fieldScope
}

const isOpen = ref(false)
const editing = ref<Field | null>(null)
const choiceRows = ref<ChoiceRow[]>([])
const choiceIconUploading = reactive<Record<number, boolean>>({})

const form = reactive<Field>({
  id: '',
  title: '',
  description: '',
  displayGroup: 'above_info',
  displayGroups: ['above_info'],
  displayOrder: 1,
  fieldScope: 'resource',
  fieldType: 'textbox',
  fieldChoices: {},
  matchType: 'none',
  matchParams: {},
  required: false,
  maxLength: 0,
  versionFilterable: false,
  viewableResource: true,
  categoryIds: []
})

function resetForm() {
  form.id = ''
  form.title = ''
  form.description = ''
  form.displayGroup = 'above_info'
  form.displayGroups = ['above_info']
  form.displayOrder = 1
  form.fieldScope = 'resource'
  form.fieldType = 'textbox'
  form.fieldChoices = {}
  form.matchType = 'none'
  form.matchParams = {}
  form.required = false
  form.maxLength = 0
  form.versionFilterable = false
  form.viewableResource = true
  form.categoryIds = []
  choiceRows.value = []
  for (const key of Object.keys(choiceIconUploading)) delete choiceIconUploading[Number(key)]
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
  form.displayGroups = [...(f.displayGroups?.length ? f.displayGroups : [f.displayGroup || 'above_info'])]
  form.displayOrder = f.displayOrder
  form.fieldScope = f.fieldScope ?? 'resource'
  form.fieldType = f.fieldType
  form.fieldChoices = { ...(f.fieldChoices ?? {}) }
  form.matchType = f.matchType ?? 'none'
  form.matchParams = { ...(f.matchParams ?? {}) }
  form.required = f.required
  form.maxLength = f.maxLength
  form.versionFilterable = Boolean(f.versionFilterable)
  form.viewableResource = f.viewableResource
  form.categoryIds = [...f.categoryIds]
  choiceRows.value = Object.entries(f.fieldChoices ?? {}).map(([key, choice]) => ({
    key,
    label: choice.label,
    iconUrl: choice.iconUrl || ''
  }))
  isOpen.value = true
}

function onCategoryTreeExpandedUpdate(keys: string[]) {
  if (!categoryChevronTogglePending.value) return
  expandedCategoryTreeKeys.value = keys
  categoryChevronTogglePending.value = false
}

function toggleCategoryTreeNode(handleToggle: () => void) {
  categoryChevronTogglePending.value = true
  handleToggle()
}

function togglePendingCategorySelection(item: CategoryTreeItem) {
  const id = Number(item.value)
  if (!Number.isFinite(id)) return
  const next = new Set(pendingCategoryIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  pendingCategoryIds.value = [...next]
}

function applyCategoryTreeSelect() {
  form.categoryIds = [...pendingCategoryIds.value]
  categoryPickerOpen.value = false
}

watch(categoryPickerOpen, (open) => {
  if (open) {
    pendingCategoryIds.value = [...form.categoryIds]
    expandedCategoryTreeKeys.value = [...defaultExpandedCategoryTreeKeys.value]
    return
  }
  categoryChevronTogglePending.value = false
})

function addChoiceRow() {
  choiceRows.value.push({ key: '', label: '', iconUrl: '' })
}

function removeChoiceRow(index: number) {
  choiceRows.value.splice(index, 1)
}

function validateForm(): string | null {
  if (!form.id.trim()) return t('validation.required_label', { label: t('admin.resource_fields_page.field_id') })
  if (!form.title.trim()) return t('validation.required_label', { label: t('admin.resource_fields_page.field_title') })
  if (form.displayGroups.length === 0) return t('validation.required_label', { label: t('admin.resource_fields_page.field_group') })

  if (['select', 'radio', 'checkbox', 'multiselect'].includes(form.fieldType)) {
    const hasChoice = choiceRows.value.some(row => row.key.trim())
    if (!hasChoice) return t('validation.required_label', { label: t('admin.resource_fields_page.field_choices') })
  }

  if (form.matchType === 'regex' && !String(form.matchParams.regex || '').trim()) {
    return t('validation.required_label', { label: t('admin.resource_fields_page.field_match_regex') })
  }

  return null
}

function getSaveErrorMessage(error: unknown) {
  const fallback = t('common.error')
  if (!error || typeof error !== 'object') return fallback

  const maybeError = error as {
    data?: {
      data?: {
        details?: FieldValidationError[]
      }
      message?: string
      statusMessage?: string
    }
    message?: string
    statusMessage?: string
  }

  const details = maybeError.data?.data?.details
  if (Array.isArray(details) && details.length > 0) {
    const first = details[0]
    if (!first) return fallback
    const pathMap: Record<string, string> = {
      'data.id': t('admin.resource_fields_page.field_id'),
      'data.title': t('admin.resource_fields_page.field_title'),
      'data.description': t('admin.resource_fields_page.field_desc'),
      'data.displayGroups': t('admin.resource_fields_page.field_group'),
      'data.fieldChoices': t('admin.resource_fields_page.field_choices'),
      'data.matchParams.regex': t('admin.resource_fields_page.field_match_regex')
    }
    const label = first.path ? pathMap[first.path] : ''
    return label ? `${label}: ${first.message || fallback}` : (first.message || fallback)
  }

  return maybeError.data?.message || maybeError.data?.statusMessage || maybeError.statusMessage || maybeError.message || fallback
}

watch(choiceRows, (rows) => {
  const out: NormalizedResourceFieldChoiceRecord = {}
  for (const row of rows) {
    const key = row.key.trim()
    if (!key) continue
    const label = row.label.trim()
    const iconUrl = row.iconUrl.trim()
    out[key] = {
      label: label || key,
      ...(iconUrl ? { iconUrl } : {})
    }
  }
  form.fieldChoices = out
}, { deep: true })

async function uploadChoiceIcon(index: number, file: File) {
  choiceIconUploading[index] = true
  try {
    const fd = new FormData()
    fd.append('kind', 'icon')
    fd.append('file', file)
    const res = await $fetch<{ success: boolean, url: string }>('/api/resources/media-upload', {
      method: 'POST',
      body: fd
    })
    if (choiceRows.value[index]) {
      choiceRows.value[index].iconUrl = res.url
    }
  } catch {
    toast.add({
      title: t('common.error'),
      description: t('admin.resource_fields_page.choice_icon_upload_failed'),
      color: 'error'
    })
  } finally {
    choiceIconUploading[index] = false
  }
}

async function onPickChoiceIcon(index: number, event: Event) {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return
  await uploadChoiceIcon(index, file)
  if (input) input.value = ''
}

watch(() => form.fieldType, (next) => {
  if (!['select', 'radio', 'checkbox', 'multiselect'].includes(next)) return
  if (choiceRows.value.length === 0) addChoiceRow()
})

watch(() => [form.fieldScope, form.fieldType] as const, ([fieldScope, fieldType]) => {
  if (fieldScope !== 'version' || !['select', 'radio', 'checkbox', 'multiselect'].includes(fieldType)) {
    form.versionFilterable = false
  }
})

async function save() {
  const validationMessage = validateForm()
  if (validationMessage) {
    toast.add({
      title: t('common.error'),
      description: validationMessage,
      color: 'error'
    })
    return
  }

  const body = editing.value
    ? { intent: 'update', fieldId: editing.value.id, data: { ...form } }
    : { intent: 'create', data: { ...form } }
  try {
    const res = await $fetch<ManageResp>('/api/admin/resource-fields/manage', { method: 'POST', body })
    if (!res.success) {
      toast.add({
        title: t('common.error'),
        description: res.error || t('common.error'),
        color: 'error'
      })
      return
    }
    isOpen.value = false
    await refresh()
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: getSaveErrorMessage(error),
      color: 'error'
    })
  }
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
      <UButton
        color="primary"
        icon="i-lucide-plus"
        @click="openCreate"
      >
        {{ t('admin.resource_fields_page.add_field') }}
      </UButton>
    </div>

    <UEmpty
      v-if="fields.length === 0"
      :title="t('admin.resource_fields_page.empty_title')"
      :description="t('admin.resource_fields_page.empty_desc')"
    >
      <template #actions>
        <UButton
          color="primary"
          icon="i-lucide-plus"
          @click="openCreate"
        >
          {{ t('admin.resource_fields_page.add_field') }}
        </UButton>
      </template>
    </UEmpty>

    <div
      v-else
      class="grid gap-3"
    >
      <UCard
        v-for="f in fields"
        :key="f.id"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <div class="font-semibold">
                {{ f.title }}
              </div>
              <div class="text-xs font-mono text-(--ui-text-muted)">
                {{ f.id }}
              </div>
            </div>
            <div
              v-if="f.description"
              class="mt-1 text-sm text-(--ui-text-muted)"
            >
              {{ f.description }}
            </div>
            <div class="mt-2 flex flex-wrap gap-2">
              <UBadge
                color="secondary"
                variant="subtle"
              >
                {{ getFieldScopeLabel(f.fieldScope) }}
              </UBadge>
              <UBadge
                v-for="group in (f.displayGroups?.length ? f.displayGroups : [f.displayGroup])"
                :key="`${f.id}-group-${group}`"
                color="neutral"
                variant="subtle"
              >
                {{ getDisplayGroupLabel(group) }}
              </UBadge>
              <UBadge
                color="primary"
                variant="subtle"
              >
                {{ getFieldTypeLabel(f.fieldType) }}
              </UBadge>
              <UBadge
                v-if="f.versionFilterable"
                color="warning"
                variant="subtle"
              >
                {{ t('admin.resource_fields_page.field_version_filterable') }}
              </UBadge>
            </div>
            <div class="text-xs text-muted mt-1">
              {{ t('admin.resource_fields_page.field_parent_categories', { categories: categories.filter(c => f.categoryIds.includes(c.id)).map(c => c.name).join(' / ') || '-' }) }}
            </div>
          </div>
          <div class="flex gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              @click="openEdit(f)"
            />
            <UButton
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              @click="removeField(f.id)"
            />
          </div>
        </div>
      </UCard>
    </div>

    <UModal
      v-model:open="isOpen"
      :dismissible="false"
      :ui="{
        content: 'sm:max-w-2xl',
        body: 'max-h-[80vh] overflow-y-auto'
      }"
    >
      <template #header>
        <div class="font-semibold">
          {{ editing ? t('admin.resource_fields_page.edit_field') : t('admin.resource_fields_page.add_field') }}
        </div>
      </template>

      <template #body>
        <div class="space-y-3">
          <UFormField :label="t('admin.resource_fields_page.field_id')">
            <UInput
              v-model="form.id"
              class="font-mono"
              :disabled="!!editing"
            />
          </UFormField>
          <UFormField :label="t('admin.resource_fields_page.field_title')">
            <UInput
              v-model="form.title"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('admin.resource_fields_page.field_desc')">
            <UTextarea
              v-model="form.description"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('admin.resource_fields_page.field_group')">
            <USelectMenu
              v-model="form.displayGroups"
              class="w-80 max-w-full"
              :items="displayGroupItems"
              value-key="value"
              multiple
            />
          </UFormField>
          <UFormField :label="t('admin.resource_fields_page.field_scope')">
            <USelect
              v-model="form.fieldScope"
              class="w-full"
              :items="fieldScopeItems"
              label-key="label"
              value-key="value"
            />
          </UFormField>
          <UFormField :label="t('admin.resource_fields_page.field_type')">
            <USelect
              v-model="form.fieldType"
              class="w-full"
              :items="fieldTypeItems"
              label-key="label"
              value-key="value"
            />
          </UFormField>
          <UFormField :label="t('admin.resource_fields_page.field_match_type')">
            <USelect
              v-model="form.matchType"
              class="w-full"
              :items="matchTypeItems"
              label-key="label"
              value-key="value"
            />
          </UFormField>
          <UFormField
            v-if="form.matchType === 'regex'"
            :label="t('admin.resource_fields_page.field_match_regex')"
          >
            <UInput v-model="form.matchParams.regex" />
          </UFormField>
          <UFormField
            v-if="form.fieldType === 'select' || form.fieldType === 'radio' || form.fieldType === 'checkbox' || form.fieldType === 'multiselect'"
            :label="t('admin.resource_fields_page.field_choices')"
          >
            <div class="space-y-2">
              <div
                v-for="(row, idx) in choiceRows"
                :key="`choice-${idx}`"
                class="rounded-md border border-(--ui-border) p-3"
              >
                <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <UInput
                    v-model="row.key"
                    :placeholder="t('admin.resource_fields_page.choice_key_placeholder')"
                  />
                  <UInput
                    v-model="row.label"
                    :placeholder="t('admin.resource_fields_page.choice_label_placeholder')"
                  />
                </div>
                <div class="mt-3 flex flex-wrap items-center gap-3">
                  <div
                    v-if="row.iconUrl"
                    class="inline-flex size-9 items-center justify-center overflow-hidden rounded-md border border-(--ui-border) bg-(--ui-bg-elevated)"
                  >
                    <img
                      :src="row.iconUrl"
                      :alt="row.label || row.key"
                      class="size-full object-cover"
                    >
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <UInput
                      type="file"
                      accept="image/*"
                      size="sm"
                      :disabled="choiceIconUploading[idx]"
                      @change="onPickChoiceIcon(idx, $event)"
                    />
                    <UButton
                      v-if="row.iconUrl"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      @click="row.iconUrl = ''"
                    >
                      {{ t('admin.resource_fields_page.choice_icon_remove') }}
                    </UButton>
                  </div>
                  <div class="ms-auto">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      @click="removeChoiceRow(idx)"
                    />
                  </div>
                </div>
              </div>
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-plus"
                @click="addChoiceRow"
              >
                {{ t('admin.resource_fields_page.add_choice') }}
              </UButton>
              <p
                v-if="choiceRows.length === 0"
                class="text-xs text-(--ui-text-muted)"
              >
                {{ t('admin.resource_fields_page.choice_empty_hint') }}
              </p>
            </div>
          </UFormField>
          <div class="grid grid-cols-2 gap-2">
            <UFormField :label="t('admin.resource_fields_page.field_order')">
              <UInput
                v-model.number="form.displayOrder"
                type="number"
              />
            </UFormField>
            <UFormField :label="t('admin.resource_fields_page.field_max')">
              <UInput
                v-model.number="form.maxLength"
                type="number"
              />
            </UFormField>
          </div>
          <UCheckbox
            v-model="form.required"
            :label="t('admin.resource_fields_page.field_required')"
          />
          <UCheckbox
            v-if="form.fieldScope === 'version' && ['select', 'radio', 'checkbox', 'multiselect'].includes(form.fieldType)"
            v-model="form.versionFilterable"
            :label="t('admin.resource_fields_page.field_version_filterable')"
          />
          <UCheckbox
            v-model="form.viewableResource"
            :label="t('admin.resource_fields_page.field_viewable')"
          />
          <UFormField :label="t('admin.resource_fields_page.field_categories')">
            <UPopover v-model:open="categoryPickerOpen">
              <UButton
                color="neutral"
                variant="outline"
                class="w-full justify-between"
                trailing-icon="i-lucide-chevron-down"
              >
                <span class="truncate">{{ categoryDisplayLabel }}</span>
              </UButton>
              <template #content>
                <div class="w-[var(--reka-popper-anchor-width)] space-y-2 p-2">
                  <div class="max-h-72 overflow-y-auto">
                    <UTree
                      :expanded="expandedCategoryTreeKeys"
                      :items="categoryTreeItems"
                      :get-key="(item) => String(item.value)"
                      @update:expanded="onCategoryTreeExpandedUpdate"
                    >
                      <template #item-wrapper="{ item, expanded, handleToggle }">
                        <div
                          :class="[
                            'relative group w-full flex items-center text-sm select-none before:absolute before:inset-y-px before:inset-x-0 before:z-[-1] before:rounded-md focus:outline-none focus-visible:outline-none focus-visible:before:ring-inset focus-visible:before:ring-2 focus-visible:before:ring-primary',
                            'px-2.5 py-1.5 gap-1.5 transition-colors before:transition-colors',
                            pendingCategoryIdSet.has(item.value)
                              ? 'before:bg-elevated text-primary'
                              : 'hover:text-highlighted hover:before:bg-elevated/50'
                          ]"
                          @click="togglePendingCategorySelection(item)"
                        >
                          <UIcon
                            :name="item.icon || (item.children?.length ? (expanded ? 'i-lucide-folder-open' : 'i-lucide-folder') : 'i-lucide-folder')"
                            class="size-5 shrink-0 relative"
                          />
                          <span class="truncate">
                            {{ item.label }}
                          </span>

                          <span
                            v-if="item.children?.length"
                            class="ms-auto inline-flex gap-1.5 items-center"
                          >
                            <button
                              type="button"
                              class="inline-flex items-center justify-center text-(--ui-text-toned) hover:text-highlighted"
                              @click.stop="toggleCategoryTreeNode(handleToggle)"
                            >
                              <UIcon
                                name="i-lucide-chevron-down"
                                :class="[
                                  'size-5 shrink-0 transform transition-transform duration-200',
                                  expanded ? 'rotate-180' : ''
                                ]"
                              />
                            </button>
                          </span>
                        </div>
                      </template>
                    </UTree>
                  </div>
                  <div class="flex justify-end gap-2 border-t border-(--ui-border) pt-2">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      @click="categoryPickerOpen = false"
                    >
                      {{ t('common.cancel') }}
                    </UButton>
                    <UButton
                      color="primary"
                      size="sm"
                      @click="applyCategoryTreeSelect"
                    >
                      {{ t('common.confirm') }}
                    </UButton>
                  </div>
                </div>
              </template>
            </UPopover>
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            @click="isOpen = false"
          >
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            color="primary"
            @click="save"
          >
            {{ t('common.save') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
