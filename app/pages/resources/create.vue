<script setup lang="ts">
const router = useRouter()
const toast = useToast()
const { t } = useI18n()

definePageMeta({
  middleware: 'auth'
})

type PublishCategory = {
  id: number
  name: string
  slug: string
  parentCategoryId: number
  icon?: string
  allowLocal: boolean
  allowExternal: boolean
  allowCommercialExternal: boolean
  allowFileless: boolean
  enableVersioning: boolean
}

type PublishField = {
  id: string
  title: string
  description: string
  displayGroup: string
  displayGroups: string[]
  displayOrder: number
  fieldType: string
  fieldChoices: Record<string, string>
  required: boolean
  maxLength: number
  categoryIds: number[]
}

type CategoryTreeItem = {
  label: string
  value: number
  icon?: string
  children?: CategoryTreeItem[]
}

type ResourceCreateValidationError = {
  path?: string
  message?: string
}

const { data } = await useFetch<{ categories: PublishCategory[], fields: PublishField[] }>('/api/resources/publish-meta')
const categories = computed(() => data.value?.categories ?? [])
const allFields = computed(() => data.value?.fields ?? [])

const form = reactive({
  title: '',
  tagLine: '',
  categoryId: 0,
  resourceType: 'download',
  description: '',
  cover: '',
  icon: '',
  supportUrl: '',
  externalUrl: '',
  externalPurchaseUrl: '',
  price: 0,
  currency: '',
  versionName: '',
  versionType: 'release',
  size: ''
})

const customFields = reactive<Record<string, string | string[]>>({})
const submitting = ref(false)
const coverUploading = ref(false)
const iconUploading = ref(false)
const coverFileName = ref('')
const iconFileName = ref('')
const categoryPickerOpen = ref(false)
const expandedCategoryTreeKeys = ref<string[]>([])
const categoryChevronTogglePending = ref(false)

const selectedCategory = computed(() => categories.value.find(c => c.id === Number(form.categoryId)) ?? null)

const resourceTypeOptions = computed(() => {
  const c = selectedCategory.value
  if (!c) return []
  const out: { label: string, value: string }[] = []
  if (c.allowLocal) out.push({ label: t('resources.publish.type_download'), value: 'download' })
  if (c.allowExternal) out.push({ label: t('resources.publish.type_external'), value: 'external' })
  if (c.allowCommercialExternal) out.push({ label: t('resources.publish.type_external_purchase'), value: 'external_purchase' })
  if (c.allowFileless) out.push({ label: t('resources.publish.type_fileless'), value: 'fileless' })
  return out
})

watch(selectedCategory, (c) => {
  if (!c) return
  if (!resourceTypeOptions.value.some(x => x.value === form.resourceType)) {
    form.resourceType = resourceTypeOptions.value[0]?.value ?? 'download'
  }
})
watch(categories, () => {
  if (form.categoryId) return
  const first = categories.value[0]
  if (first) form.categoryId = first.id
}, { immediate: true })

const fields = computed(() => {
  const cid = Number(form.categoryId)
  if (!cid) return []
  return allFields.value
    .filter(f => f.categoryIds.includes(cid))
    .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0))
})
function normalizeDisplayGroup(group: string) {
  if (group === 'above_info' || group === 'above_rating') return 'above_info'
  if (group === 'below_info' || group === 'below_rating' || group === 'extra_tab' || group === 'new_tab') return 'below_info'
  if (group === 'sidebar' || group === 'below_sidebar_buttons') return 'sidebar'
  return 'below_info'
}
function getNormalizedDisplayGroups(field: PublishField) {
  const rawGroups = field.displayGroups?.length ? field.displayGroups : [field.displayGroup]
  return Array.from(new Set(rawGroups.map(normalizeDisplayGroup)))
}
const fieldsAboveInfo = computed(() => fields.value.filter(f => getNormalizedDisplayGroups(f).includes('above_info')))
const fieldsBelowInfo = computed(() => fields.value.filter(f => getNormalizedDisplayGroups(f).includes('below_info')))
const fieldsSidebar = computed(() => fields.value.filter(f => getNormalizedDisplayGroups(f).includes('sidebar')))
const selectedCategoryName = computed(() => selectedCategory.value?.name ?? '')
const fieldLabelById = computed(() => {
  const map = new Map<string, string>()
  for (const field of fields.value) {
    map.set(field.id, field.title)
  }
  return map
})
const categoryTreeItems = computed<CategoryTreeItem[]>(() => {
  const byParent = new Map<number, PublishCategory[]>()
  for (const category of categories.value) {
    const parentId = Number(category.parentCategoryId ?? 0)
    const list = byParent.get(parentId) ?? []
    list.push(category)
    byParent.set(parentId, list)
  }
  const build = (parentId: number): CategoryTreeItem[] => {
    const children = (byParent.get(parentId) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))
    return children.map((child) => {
      const nodes = build(child.id)
      return {
        label: child.name,
        value: child.id,
        icon: child.icon || 'i-lucide-folder',
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
function onCategoryTreeSelect(item: unknown) {
  if (!item || typeof item !== 'object' || !('value' in item)) return
  const value = Number((item as { value: number }).value)
  if (!Number.isFinite(value)) return
  form.categoryId = value
  categoryPickerOpen.value = false
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
watch(categoryPickerOpen, (open) => {
  if (open) {
    expandedCategoryTreeKeys.value = [...defaultExpandedCategoryTreeKeys.value]
    return
  }
  categoryChevronTogglePending.value = false
})

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function validateForm() {
  if (!form.title.trim()) return t('validation.required_label', { label: t('resources.publish.title') })
  if (!Number(form.categoryId)) return t('validation.required_label', { label: t('resources.publish.category') })
  if (!form.description.trim()) return t('validation.required_label', { label: t('resources.publish.description') })

  if (form.supportUrl.trim() && !isHttpUrl(form.supportUrl.trim())) {
    return t('validation.invalid_format_label', { label: t('resources.publish.support_url') })
  }

  if (form.resourceType === 'external' || form.resourceType === 'external_purchase') {
    if (!form.externalUrl.trim()) return t('validation.required_label', { label: t('resources.publish.external_url') })
    if (!isHttpUrl(form.externalUrl.trim())) return t('validation.invalid_format_label', { label: t('resources.publish.external_url') })
  }

  if (form.resourceType === 'external_purchase') {
    if (form.externalPurchaseUrl.trim() && !isHttpUrl(form.externalPurchaseUrl.trim())) {
      return t('validation.invalid_format_label', { label: t('resources.publish.purchase_url') })
    }
  }

  for (const field of fields.value) {
    const rawValue = customFields[field.id]
    const value = Array.isArray(rawValue)
      ? rawValue.join(',').trim()
      : String(rawValue ?? '').trim()

    if (field.required && !value) return t('validation.required_label', { label: field.title })
    if (!value) continue

    if (Number(field.maxLength || 0) > 0 && value.length > Number(field.maxLength)) {
      return t('validation.max_length_label', { label: field.title, max: field.maxLength })
    }

    const choices = Object.keys(field.fieldChoices ?? {})
    if (choices.length === 0) continue

    if (field.fieldType === 'select' || field.fieldType === 'radio') {
      if (!choices.includes(value)) return t('validation.invalid_choice_label', { label: field.title })
      continue
    }

    if (field.fieldType === 'multiselect' || field.fieldType === 'checkbox') {
      const selectedValues = value.split(',').map(item => item.trim()).filter(Boolean)
      if (selectedValues.some(choice => !choices.includes(choice))) {
        return t('validation.invalid_choice_label', { label: field.title })
      }
    }
  }

  return null
}

function getSubmitErrorMessage(error: unknown) {
  const fallback = t('resources.publish.failed')
  if (!error || typeof error !== 'object') return fallback

  const maybeError = error as {
    data?: {
      data?: {
        details?: ResourceCreateValidationError[]
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
    const pathMap: Record<string, string> = {
      title: t('resources.publish.title'),
      tagLine: t('resources.publish.tagline'),
      categoryId: t('resources.publish.category'),
      description: t('resources.publish.description'),
      supportUrl: t('resources.publish.support_url'),
      externalUrl: t('resources.publish.external_url'),
      externalPurchaseUrl: t('resources.publish.purchase_url'),
      price: t('resources.publish.price'),
      currency: t('resources.publish.currency'),
      cover: t('resources.media_cover_upload'),
      icon: t('resources.media_icon_upload')
    }
    const label = first?.path ? pathMap[first.path] : ''
    return label ? `${label}: ${first?.message || fallback}` : (first?.message || fallback)
  }

  const statusMessage = maybeError.data?.message || maybeError.data?.statusMessage || maybeError.statusMessage || maybeError.message
  if (!statusMessage) return fallback

  const missingFieldMatch = statusMessage.match(/^Required field missing: (.+)$/)
  if (missingFieldMatch) {
    const fieldId = missingFieldMatch[1] ?? ''
    const fieldLabel = fieldLabelById.value.get(fieldId.trim()) || fieldId.trim()
    return t('validation.required_label', { label: fieldLabel })
  }

  const invalidChoiceMatch = statusMessage.match(/^Invalid field choice: (.+)$/)
  if (invalidChoiceMatch) {
    const fieldId = invalidChoiceMatch[1] ?? ''
    const fieldLabel = fieldLabelById.value.get(fieldId.trim()) || fieldId.trim()
    return t('validation.invalid_choice_label', { label: fieldLabel })
  }

  const tooLongMatch = statusMessage.match(/^Field too long: (.+)$/)
  if (tooLongMatch) {
    const fieldId = (tooLongMatch[1] ?? '').trim()
    const field = fields.value.find(item => item.id === fieldId)
    if (field?.maxLength) return t('validation.max_length_label', { label: field.title, max: field.maxLength })
    return t('validation.content_too_long_label', { label: fieldLabelById.value.get(fieldId) || fieldId })
  }

  const invalidFormatMatch = statusMessage.match(/^Invalid field format: (.+)$/)
  if (invalidFormatMatch) {
    const fieldId = invalidFormatMatch[1] ?? ''
    const fieldLabel = fieldLabelById.value.get(fieldId.trim()) || fieldId.trim()
    return t('validation.invalid_format_label', { label: fieldLabel })
  }

  return statusMessage
}

async function submit() {
  const validationMessage = validateForm()
  if (validationMessage) {
    toast.add({ title: t('common.error'), description: validationMessage, color: 'error' })
    return
  }

  submitting.value = true
  try {
    const res = await $fetch<{ success: boolean, redirectTo: string }>('/api/resources/create', {
      method: 'POST',
      body: {
        ...form,
        supportUrl: form.supportUrl || undefined,
        externalUrl: form.externalUrl || undefined,
        externalPurchaseUrl: form.externalPurchaseUrl || undefined,
        currency: form.currency || undefined,
        customFields: Object.fromEntries(
          Object.entries(customFields).map(([key, value]) => [
            key,
            Array.isArray(value) ? value.join(',') : String(value ?? '')
          ])
        )
      }
    })
    if (res.success) {
      await router.push(res.redirectTo)
      return
    }
  } catch (error) {
    toast.add({ title: t('common.error'), description: getSubmitErrorMessage(error), color: 'error' })
  } finally {
    submitting.value = false
  }
}

function fieldChoiceItems(field: PublishField) {
  return Object.entries(field.fieldChoices ?? {}).map(([value, label]) => ({ label, value }))
}

function fieldDescriptionWithLimit(field: PublishField) {
  const base = String(field.description || '').trim()
  const maxLength = Number(field.maxLength || 0)
  if (maxLength <= 0) return base || undefined
  const limitText = `${t('admin.resource_fields_page.field_max')}: ${maxLength}`
  return base ? `${base} (${limitText})` : limitText
}

function isChoiceChecked(fieldId: string, value: string) {
  const current = customFields[fieldId]
  return Array.isArray(current) && current.includes(value)
}

function setChoiceChecked(fieldId: string, value: string, checked: boolean) {
  const current = customFields[fieldId]
  const next = Array.isArray(current) ? [...current] : []
  const exists = next.includes(value)
  if (checked && !exists) next.push(value)
  if (!checked && exists) {
    const index = next.indexOf(value)
    if (index >= 0) next.splice(index, 1)
  }
  customFields[fieldId] = next
}

function ensureCustomFieldDefaults() {
  for (const field of fields.value) {
    const current = customFields[field.id]
    if (field.fieldType === 'multiselect' || field.fieldType === 'checkbox') {
      if (!Array.isArray(current)) customFields[field.id] = []
      continue
    }
    if (Array.isArray(current)) {
      customFields[field.id] = current.join(',')
      continue
    }
    if (typeof current !== 'string') {
      customFields[field.id] = ''
    }
  }
}

watch(fields, () => {
  ensureCustomFieldDefaults()
}, { immediate: true })

async function uploadMedia(kind: 'cover' | 'icon', file: File) {
  const fd = new FormData()
  fd.append('kind', kind)
  fd.append('file', file)
  const res = await $fetch<{ success: boolean, url: string }>('/api/resources/media-upload', {
    method: 'POST',
    body: fd
  })
  if (kind === 'cover') {
    form.cover = res.url
    coverFileName.value = file.name
  } else {
    form.icon = res.url
    iconFileName.value = file.name
  }
}

async function onPickMedia(kind: 'cover' | 'icon', event: Event) {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return
  if (kind === 'cover') coverUploading.value = true
  else iconUploading.value = true
  try {
    await uploadMedia(kind, file)
  } catch {
    toast.add({
      title: t('common.error'),
      description: t('resources.media_upload_failed'),
      color: 'error'
    })
  } finally {
    if (input) input.value = ''
    if (kind === 'cover') coverUploading.value = false
    else iconUploading.value = false
  }
}
</script>

<template>
  <UContainer class="py-6">
    <div class="mb-3 text-lg font-semibold">
      {{ t('resources.publish_title') }}
    </div>
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div class="space-y-4">
        <UCard>
          <template #header>
            <div class="font-medium">
              {{ t('admin.resource_categories_page.sections.basic') }}
            </div>
          </template>
          <div class="space-y-3">
            <UFormField :label="t('resources.publish.title')">
              <UInput v-model="form.title" />
            </UFormField>
            <UFormField
              :label="t('resources.publish.tagline')"
              :description="t('resources.publish.tagline_desc')"
            >
              <UInput v-model="form.tagLine" />
            </UFormField>
            <UFormField :label="t('resources.publish.category')">
              <UPopover v-model:open="categoryPickerOpen">
                <UButton
                  color="neutral"
                  variant="outline"
                  class="w-full justify-between"
                  trailing-icon="i-lucide-chevron-down"
                >
                  {{ selectedCategoryName || t('resources.publish.category') }}
                </UButton>
                <template #content>
                  <div class="w-[var(--reka-popper-anchor-width)] max-h-72 overflow-y-auto p-2">
                    <UTree
                      :expanded="expandedCategoryTreeKeys"
                      :items="categoryTreeItems"
                      :get-key="(item) => String(item.value)"
                      @update:model-value="onCategoryTreeSelect"
                      @update:expanded="onCategoryTreeExpandedUpdate"
                    >
                      <template #item-wrapper="{ item, expanded, handleToggle }">
                        <div
                          :class="[
                            'relative group w-full flex items-center text-sm select-none before:absolute before:inset-y-px before:inset-x-0 before:z-[-1] before:rounded-md',
                            'focus:outline-none focus-visible:outline-none focus-visible:before:ring-inset focus-visible:before:ring-2 focus-visible:before:ring-primary',
                            'px-2.5 py-1.5 gap-1.5 transition-colors before:transition-colors',
                            Number(form.categoryId) === Number(item.value)
                              ? 'before:bg-elevated text-primary'
                              : 'hover:text-highlighted hover:before:bg-elevated/50'
                          ]"
                          @click="onCategoryTreeSelect(item)"
                        >
                          <UIcon
                            :name="item.icon || (item.children?.length ? (expanded ? 'i-lucide-folder-open' : 'i-lucide-folder') : 'i-lucide-folder')"
                            class="size-5 shrink-0 relative"
                          />
                          <span class="truncate">{{ item.label }}</span>
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
                </template>
              </UPopover>
            </UFormField>
            <UFormField :label="t('resources.publish.type')">
              <URadioGroup
                v-model="form.resourceType"
                :items="resourceTypeOptions"
                value-key="value"
                label-key="label"
                orientation="horizontal"
              />
            </UFormField>
          </div>
        </UCard>

        <UCard v-if="fieldsAboveInfo.length">
          <template #header>
            <div class="font-medium">
              {{ t('admin.resource_fields_page.display_group_above_info') }}
            </div>
          </template>
          <div class="space-y-3">
            <UFormField
              v-for="f in fieldsAboveInfo"
              :key="f.id"
              :label="f.title"
              :description="fieldDescriptionWithLimit(f)"
              :required="f.required"
            >
              <UTextarea
                v-if="f.fieldType === 'textarea'"
                v-model="customFields[f.id] as string"
                :maxlength="Number(f.maxLength || 0) > 0 ? Number(f.maxLength) : undefined"
              />
              <USelect
                v-else-if="f.fieldType === 'select'"
                v-model="customFields[f.id] as string"
                class="w-72 max-w-full"
                :items="fieldChoiceItems(f)"
                label-key="label"
                value-key="value"
              />
              <URadioGroup
                v-else-if="f.fieldType === 'radio'"
                v-model="customFields[f.id] as string"
                :items="fieldChoiceItems(f)"
                value-key="value"
                orientation="horizontal"
              />
              <div
                v-else-if="f.fieldType === 'checkbox'"
                class="grid gap-2"
              >
                <UCheckbox
                  v-for="option in fieldChoiceItems(f)"
                  :key="`${f.id}-${option.value}`"
                  :label="option.label"
                  :model-value="isChoiceChecked(f.id, option.value)"
                  @update:model-value="value => setChoiceChecked(f.id, option.value, !!value)"
                />
              </div>
              <USelectMenu
                v-else-if="f.fieldType === 'multiselect'"
                v-model="customFields[f.id] as string[]"
                class="w-72 max-w-full"
                :items="fieldChoiceItems(f)"
                value-key="value"
                multiple
              />
              <UInput
                v-else
                v-model="customFields[f.id] as string"
                :maxlength="Number(f.maxLength || 0) > 0 ? Number(f.maxLength) : undefined"
              />
            </UFormField>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="font-medium">
              {{ t('resources.publish.description') }}
            </div>
          </template>
          <UFormField :label="t('resources.publish.description')">
            <UTextarea
              v-model="form.description"
              :rows="8"
              class="w-full"
            />
          </UFormField>
        </UCard>

        <UCard>
          <template #header>
            <div class="font-medium">
              {{ t('resources.media_manage') }}
            </div>
          </template>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <UFormField :label="t('resources.media_cover_upload')">
              <div class="space-y-2">
                <UInput
                  type="file"
                  accept="image/*"
                  @change="onPickMedia('cover', $event)"
                />
                <div class="text-xs text-(--ui-text-muted)">
                  <span v-if="coverUploading">{{ t('resources.uploading') }}</span>
                  <span v-else-if="coverFileName">{{ coverFileName }}</span>
                  <span v-else>{{ t('resources.upload_cover') }}</span>
                </div>
              </div>
            </UFormField>
            <UFormField :label="t('resources.media_icon_upload')">
              <div class="space-y-2">
                <UInput
                  type="file"
                  accept="image/*"
                  @change="onPickMedia('icon', $event)"
                />
                <div class="text-xs text-(--ui-text-muted)">
                  <span v-if="iconUploading">{{ t('resources.uploading') }}</span>
                  <span v-else-if="iconFileName">{{ iconFileName }}</span>
                  <span v-else>{{ t('resources.upload_icon') }}</span>
                </div>
              </div>
            </UFormField>
          </div>
        </UCard>

        <UCard v-if="fieldsBelowInfo.length">
          <template #header>
            <div class="font-medium">
              {{ t('admin.resource_fields_page.display_group_below_info') }}
            </div>
          </template>
          <div class="space-y-3">
            <UFormField
              v-for="f in fieldsBelowInfo"
              :key="f.id"
              :label="f.title"
              :description="fieldDescriptionWithLimit(f)"
              :required="f.required"
            >
              <UTextarea
                v-if="f.fieldType === 'textarea'"
                v-model="customFields[f.id] as string"
                :maxlength="Number(f.maxLength || 0) > 0 ? Number(f.maxLength) : undefined"
              />
              <USelect
                v-else-if="f.fieldType === 'select'"
                v-model="customFields[f.id] as string"
                class="w-72 max-w-full"
                :items="fieldChoiceItems(f)"
                label-key="label"
                value-key="value"
              />
              <URadioGroup
                v-else-if="f.fieldType === 'radio'"
                v-model="customFields[f.id] as string"
                :items="fieldChoiceItems(f)"
                value-key="value"
                orientation="horizontal"
              />
              <div
                v-else-if="f.fieldType === 'checkbox'"
                class="grid gap-2"
              >
                <UCheckbox
                  v-for="option in fieldChoiceItems(f)"
                  :key="`${f.id}-${option.value}`"
                  :label="option.label"
                  :model-value="isChoiceChecked(f.id, option.value)"
                  @update:model-value="value => setChoiceChecked(f.id, option.value, !!value)"
                />
              </div>
              <USelectMenu
                v-else-if="f.fieldType === 'multiselect'"
                v-model="customFields[f.id] as string[]"
                class="w-72 max-w-full"
                :items="fieldChoiceItems(f)"
                value-key="value"
                multiple
              />
              <UInput
                v-else
                v-model="customFields[f.id] as string"
                :maxlength="Number(f.maxLength || 0) > 0 ? Number(f.maxLength) : undefined"
              />
            </UFormField>
          </div>
        </UCard>
      </div>

      <div class="space-y-4">
        <UCard v-if="fieldsSidebar.length">
          <template #header>
            <div class="font-medium">
              {{ t('admin.resource_fields_page.display_group_sidebar') }}
            </div>
          </template>
          <div class="space-y-3">
            <UFormField
              v-for="f in fieldsSidebar"
              :key="f.id"
              :label="f.title"
              :description="fieldDescriptionWithLimit(f)"
              :required="f.required"
            >
              <UTextarea
                v-if="f.fieldType === 'textarea'"
                v-model="customFields[f.id] as string"
                :maxlength="Number(f.maxLength || 0) > 0 ? Number(f.maxLength) : undefined"
              />
              <USelect
                v-else-if="f.fieldType === 'select'"
                v-model="customFields[f.id] as string"
                class="w-72 max-w-full"
                :items="fieldChoiceItems(f)"
                label-key="label"
                value-key="value"
              />
              <URadioGroup
                v-else-if="f.fieldType === 'radio'"
                v-model="customFields[f.id] as string"
                :items="fieldChoiceItems(f)"
                value-key="value"
                orientation="horizontal"
              />
              <div
                v-else-if="f.fieldType === 'checkbox'"
                class="grid gap-2"
              >
                <UCheckbox
                  v-for="option in fieldChoiceItems(f)"
                  :key="`${f.id}-${option.value}`"
                  :label="option.label"
                  :model-value="isChoiceChecked(f.id, option.value)"
                  @update:model-value="value => setChoiceChecked(f.id, option.value, !!value)"
                />
              </div>
              <USelectMenu
                v-else-if="f.fieldType === 'multiselect'"
                v-model="customFields[f.id] as string[]"
                class="w-72 max-w-full"
                :items="fieldChoiceItems(f)"
                value-key="value"
                multiple
              />
              <UInput
                v-else
                v-model="customFields[f.id] as string"
                :maxlength="Number(f.maxLength || 0) > 0 ? Number(f.maxLength) : undefined"
              />
            </UFormField>
          </div>
        </UCard>

        <UCard class="sticky top-22">
          <template #header>
            <div class="font-medium">
              {{ t('common.actions') }}
            </div>
          </template>
          <div class="space-y-3">
            <UFormField
              v-if="form.resourceType === 'external' || form.resourceType === 'external_purchase'"
              :label="t('resources.publish.external_url')"
            >
              <UInput v-model="form.externalUrl" />
            </UFormField>
            <UFormField
              v-if="form.resourceType === 'external_purchase'"
              :label="t('resources.publish.purchase_url')"
            >
              <UInput v-model="form.externalPurchaseUrl" />
            </UFormField>
            <div
              v-if="form.resourceType === 'external_purchase'"
              class="grid grid-cols-2 gap-2"
            >
              <UFormField :label="t('resources.publish.price')">
                <UInput
                  v-model.number="form.price"
                  type="number"
                />
              </UFormField>
              <UFormField :label="t('resources.publish.currency')">
                <UInput v-model="form.currency" />
              </UFormField>
            </div>
            <UFormField :label="t('resources.publish.support_url')">
              <UInput v-model="form.supportUrl" />
            </UFormField>
            <UButton
              block
              color="primary"
              :loading="submitting"
              @click="submit"
            >
              {{ t('resources.publish.submit') }}
            </UButton>
          </div>
        </UCard>
      </div>
    </div>
  </UContainer>
</template>
