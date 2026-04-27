<script setup lang="ts">
type ResourceTemplate = {
  id: number
  name: string
  key: string
}

type ResourceCategoryItem = {
  id: number
  name: string
  parentCategoryId: number
  icon?: string
}

type ManageResponse = {
  success: boolean
  message?: string
  error?: string
}

const { t } = useI18n()
const router = useRouter()
const toast = useToast()

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
  ssr: false
})

useHead({
  title: () => t('admin.resource_categories_page.add_category')
})

const { data } = await useFetch<{ templates: ResourceTemplate[], categories: ResourceCategoryItem[] }>('/api/admin/resource-categories/page')
const templates = computed(() => data.value?.templates ?? [])
const categories = computed(() => data.value?.categories ?? [])
const iconOptions = computed(() => [
  { label: t('admin.resource_categories_page.icon_folder'), value: 'i-lucide-folder' },
  { label: t('admin.resource_categories_page.icon_boxes'), value: 'i-lucide-boxes' },
  { label: t('admin.resource_categories_page.icon_package'), value: 'i-lucide-package' },
  { label: t('admin.resource_categories_page.icon_file'), value: 'i-lucide-file' },
  { label: t('admin.resource_categories_page.icon_tag'), value: 'i-lucide-tag' },
  { label: t('admin.resource_categories_page.icon_wrench'), value: 'i-lucide-wrench' },
  { label: t('admin.resource_categories_page.icon_puzzle'), value: 'i-lucide-puzzle' },
  { label: t('admin.resource_categories_page.icon_book'), value: 'i-lucide-book' }
])
const parentPickerOpen = ref(false)
const pendingParentCategoryId = ref(0)
const expandedParentTreeKeys = ref<string[]>([])
const parentChevronTogglePending = ref(false)
const categoryNameById = computed(() => {
  const map = new Map<number, string>()
  for (const category of categories.value) {
    map.set(category.id, category.name)
  }
  return map
})
const parentDisplayLabel = computed(() => {
  if (!form.parentCategoryId) return t('admin.resource_categories_page.fields.parent_none')
  return categoryNameById.value.get(form.parentCategoryId) ?? t('admin.resource_categories_page.fields.parent_none')
})
const parentTreeItems = computed(() => {
  const childrenByParent = new Map<number, ResourceCategoryItem[]>()
  for (const category of categories.value) {
    const parentId = Number(category.parentCategoryId ?? 0)
    const list = childrenByParent.get(parentId) ?? []
    list.push(category)
    childrenByParent.set(parentId, list)
  }

  const walk = (parentId: number): Array<{ label: string, value: number, children?: Array<{ label: string, value: number }> }> => {
    const children = (childrenByParent.get(parentId) ?? []).sort((a, b) => a.name.localeCompare(b.name))
    return children.map((child) => {
      const nextChildren = walk(child.id)
      return {
        label: child.name,
        value: child.id,
        ...(nextChildren.length > 0 ? { children: nextChildren } : {})
      }
    })
  }

  return [
    { value: 0, label: t('admin.resource_categories_page.fields.parent_none') },
    ...walk(0)
  ]
})
const defaultExpandedParentTreeKeys = computed(() => {
  const keys: string[] = []
  const walk = (items: Array<{ label: string, value: number, children?: Array<{ label: string, value: number }> }>) => {
    for (const item of items) {
      if (item.children?.length) {
        keys.push(String(item.value))
        walk(item.children)
      }
    }
  }
  walk(parentTreeItems.value)
  return keys
})
function onParentTreeSelect(item: unknown) {
  if (!item || typeof item !== 'object' || !('value' in item)) return
  const value = Number((item as { value: number }).value)
  pendingParentCategoryId.value = Number.isFinite(value) ? value : 0
}
function onParentTreeExpandedUpdate(keys: string[]) {
  if (!parentChevronTogglePending.value) return
  expandedParentTreeKeys.value = keys
  parentChevronTogglePending.value = false
}
function toggleParentTreeNode(handleToggle: () => void) {
  parentChevronTogglePending.value = true
  handleToggle()
}
function applyParentTreeSelect() {
  form.parentCategoryId = pendingParentCategoryId.value
  parentPickerOpen.value = false
}
watch(parentPickerOpen, (open) => {
  if (open) {
    pendingParentCategoryId.value = form.parentCategoryId
    expandedParentTreeKeys.value = [...defaultExpandedParentTreeKeys.value]
    return
  }
  parentChevronTogglePending.value = false
})

const form = reactive({
  name: '',
  slug: '',
  description: '',
  templateId: undefined as number | undefined,
  allowLocal: true,
  allowExternal: true,
  allowCommercialExternal: false,
  allowFileless: true,
  alwaysModerateCreate: false,
  alwaysModerateUpdate: false,
  enableVersioning: true,
  enableSupportUrl: true,
  requirePrefix: false,
  minTags: 0,
  parentCategoryId: 0,
  displayOrder: 1,
  icon: 'i-lucide-folder'
})

watch(templates, () => {
  if (form.templateId === undefined && templates.value.length > 0) {
    form.templateId = templates.value[0]?.id
  }
}, { immediate: true })

function templateLabel(template: ResourceTemplate) {
  const normalizedKey = template.key === 'square' ? 'grid' : template.key
  const translated = t(`admin.resource_templates.${normalizedKey}`)
  if (translated && translated !== `admin.resource_templates.${normalizedKey}`) return translated
  return template.name
}

function validateForm() {
  if (!form.name.trim()) return t('validation.required_label', { label: t('admin.resource_categories_page.name') })
  if (form.templateId === undefined) return t('validation.required_label', { label: t('admin.resource_categories_page.col_template') })
  if (!form.icon.trim()) return t('validation.required_label', { label: t('admin.resource_categories_page.fields.icon') })
  return null
}

function getSubmitErrorMessage(error: unknown) {
  const fallback = t('common.error')
  if (!error || typeof error !== 'object') return fallback

  const maybeError = error as {
    data?: {
      message?: string
      statusMessage?: string
      data?: {
        details?: Array<{ path?: string, message?: string }>
      }
    }
    message?: string
    statusMessage?: string
  }

  const first = maybeError.data?.data?.details?.[0]
  if (first?.message) {
    const pathMap: Record<string, string> = {
      'data.name': t('admin.resource_categories_page.name'),
      'data.slug': t('admin.resource_categories_page.slug'),
      'data.description': t('admin.resource_categories_page.description'),
      'data.templateId': t('admin.resource_categories_page.col_template'),
      'data.icon': t('admin.resource_categories_page.fields.icon'),
      'data.minTags': t('admin.resource_categories_page.fields.min_tags'),
      'data.parentCategoryId': t('admin.resource_categories_page.fields.parent_category_id'),
      'data.displayOrder': t('admin.resource_categories_page.fields.display_order')
    }
    const label = first.path ? pathMap[first.path] : ''
    return label ? `${label}: ${first.message}` : first.message
  }

  return maybeError.data?.message || maybeError.data?.statusMessage || maybeError.statusMessage || maybeError.message || fallback
}

async function submit() {
  const validationMessage = validateForm()
  if (validationMessage) {
    toast.add({ title: t('common.error'), description: validationMessage, color: 'error' })
    return
  }
  if (form.templateId === undefined) return
  try {
    const res = await $fetch<ManageResponse>('/api/admin/resource-categories/manage', {
      method: 'POST',
      body: {
        intent: 'create',
        data: {
          name: form.name,
          slug: form.slug || undefined,
          description: form.description || undefined,
          templateId: form.templateId,
          icon: form.icon,
          allowLocal: form.allowLocal,
          allowExternal: form.allowExternal,
          allowCommercialExternal: form.allowCommercialExternal,
          allowFileless: form.allowFileless,
          alwaysModerateCreate: form.alwaysModerateCreate,
          alwaysModerateUpdate: form.alwaysModerateUpdate,
          enableVersioning: form.enableVersioning,
          enableSupportUrl: form.enableSupportUrl,
          requirePrefix: form.requirePrefix,
          minTags: form.minTags,
          parentCategoryId: form.parentCategoryId,
          displayOrder: form.displayOrder
        }
      }
    })

    if (!res.success) {
      toast.add({ title: t('common.error'), description: res.error || t('common.error'), color: 'error' })
      return
    }
    await router.push('/admin/resource-categories')
  } catch (error) {
    toast.add({ title: t('common.error'), description: getSubmitErrorMessage(error), color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">
          {{ t('admin.resource_categories_page.add_category') }}
        </h2>
        <p class="text-(--ui-text-muted)">
          {{ t('admin.resource_categories_page.subtitle') }}
        </p>
      </div>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        @click="router.push('/admin/resource-categories')"
      >
        {{ t('common.back') }}
      </UButton>
    </div>

    <UCard>
      <UForm
        :state="form"
        class="space-y-4"
        @submit.prevent="submit"
      >
        <div class="space-y-1">
          <h4 class="text-sm font-semibold">
            {{ t('admin.resource_categories_page.sections.basic') }}
          </h4>
          <p class="text-xs text-(--ui-text-muted)">
            {{ t('admin.resource_categories_page.section_hints.basic') }}
          </p>
        </div>
        <UFormField :label="t('admin.resource_categories_page.name')">
          <UInput v-model="form.name" />
        </UFormField>
        <UFormField :label="t('admin.resource_categories_page.slug')">
          <UInput
            v-model="form.slug"
            class="font-mono"
          />
        </UFormField>
        <UFormField :label="t('admin.resource_categories_page.description')">
          <UTextarea v-model="form.description" />
        </UFormField>
        <UFormField :label="t('admin.resource_categories_page.fields.icon')">
          <USelect
            v-model="form.icon"
            :items="iconOptions"
            option-attribute="label"
            value-attribute="value"
          />
        </UFormField>
        <UFormField :label="t('admin.resource_categories_page.col_template')">
          <USelect
            v-model="form.templateId"
            :items="templates.map((tpl) => ({ value: tpl.id, label: templateLabel(tpl) }))"
            option-attribute="label"
            value-attribute="value"
          />
        </UFormField>

        <UDivider />
        <div class="space-y-1">
          <h4 class="text-sm font-semibold">
            {{ t('admin.resource_categories_page.sections.types') }}
          </h4>
          <p class="text-xs text-(--ui-text-muted)">
            {{ t('admin.resource_categories_page.section_hints.types') }}
          </p>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <UCheckbox
            v-model="form.allowLocal"
            :label="t('admin.resource_categories_page.flags.allow_local')"
          />
          <UCheckbox
            v-model="form.allowExternal"
            :label="t('admin.resource_categories_page.flags.allow_external')"
          />
          <UCheckbox
            v-model="form.allowCommercialExternal"
            :label="t('admin.resource_categories_page.flags.allow_commercial_external')"
          />
          <UCheckbox
            v-model="form.allowFileless"
            :label="t('admin.resource_categories_page.flags.allow_fileless')"
          />
        </div>

        <UDivider />
        <div class="space-y-1">
          <h4 class="text-sm font-semibold">
            {{ t('admin.resource_categories_page.sections.features') }}
          </h4>
          <p class="text-xs text-(--ui-text-muted)">
            {{ t('admin.resource_categories_page.section_hints.features') }}
          </p>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <UCheckbox
            v-model="form.enableVersioning"
            :label="t('admin.resource_categories_page.flags.enable_versioning')"
          />
          <UCheckbox
            v-model="form.enableSupportUrl"
            :label="t('admin.resource_categories_page.flags.enable_support_url')"
          />
        </div>

        <UDivider />
        <div class="space-y-1">
          <h4 class="text-sm font-semibold">
            {{ t('admin.resource_categories_page.sections.moderation') }}
          </h4>
          <p class="text-xs text-(--ui-text-muted)">
            {{ t('admin.resource_categories_page.section_hints.moderation') }}
          </p>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <UCheckbox
            v-model="form.alwaysModerateCreate"
            :label="t('admin.resource_categories_page.flags.always_moderate_create')"
          />
          <UCheckbox
            v-model="form.alwaysModerateUpdate"
            :label="t('admin.resource_categories_page.flags.always_moderate_update')"
          />
        </div>
        <UFormField :label="t('admin.resource_categories_page.fields.min_tags')">
          <UInput
            v-model.number="form.minTags"
            type="number"
          />
        </UFormField>

        <UDivider />
        <div class="space-y-1">
          <h4 class="text-sm font-semibold">
            {{ t('admin.resource_categories_page.sections.associations') }}
          </h4>
          <p class="text-xs text-(--ui-text-muted)">
            {{ t('admin.resource_categories_page.section_hints.associations') }}
          </p>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <UFormField :label="t('admin.resource_categories_page.fields.parent_category_id')">
            <UPopover v-model:open="parentPickerOpen">
              <UButton
                color="neutral"
                variant="outline"
                class="w-full justify-between"
                trailing-icon="i-lucide-chevron-down"
              >
                {{ parentDisplayLabel }}
              </UButton>
              <template #content>
                <div class="w-[var(--reka-popper-anchor-width)] space-y-2 p-2">
                  <div class="max-h-72 overflow-y-auto">
                    <UTree
                      :expanded="expandedParentTreeKeys"
                      :items="parentTreeItems"
                      :get-key="(item) => String(item.value)"
                      @update:model-value="onParentTreeSelect"
                      @update:expanded="onParentTreeExpandedUpdate"
                    >
                      <template #item-wrapper="{ item, expanded, handleToggle }">
                        <div
                          :class="[
                            'relative group w-full flex items-center text-sm select-none before:absolute before:inset-y-px before:inset-x-0 before:z-[-1] before:rounded-md',
                            'focus:outline-none focus-visible:outline-none focus-visible:before:ring-inset focus-visible:before:ring-2 focus-visible:before:ring-primary',
                            'px-2.5 py-1.5 gap-1.5 transition-colors before:transition-colors',
                            Number(pendingParentCategoryId) === Number(item.value)
                              ? 'before:bg-elevated text-primary'
                              : 'hover:text-highlighted hover:before:bg-elevated/50'
                          ]"
                          @click="onParentTreeSelect(item)"
                        >
                          <UIcon
                            :name="item.children?.length ? (expanded ? 'i-lucide-folder-open' : 'i-lucide-folder') : 'i-lucide-folder'"
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
                              @click.stop="toggleParentTreeNode(handleToggle)"
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
                      @click="parentPickerOpen = false"
                    >
                      {{ t('common.cancel') }}
                    </UButton>
                    <UButton
                      color="primary"
                      size="sm"
                      @click="applyParentTreeSelect"
                    >
                      {{ t('common.confirm') }}
                    </UButton>
                  </div>
                </div>
              </template>
            </UPopover>
          </UFormField>
          <UFormField :label="t('admin.resource_categories_page.fields.display_order')">
            <UInput
              v-model.number="form.displayOrder"
              type="number"
            />
          </UFormField>
        </div>
        <UCheckbox
          v-model="form.requirePrefix"
          :label="t('admin.resource_categories_page.flags.require_prefix')"
        />

        <div class="flex justify-end gap-3 pt-2">
          <UButton
            color="neutral"
            variant="ghost"
            @click="router.push('/admin/resource-categories')"
          >
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            type="submit"
            color="primary"
          >
            {{ t('common.confirm') }}
          </UButton>
        </div>
      </UForm>
    </UCard>
  </div>
</template>
