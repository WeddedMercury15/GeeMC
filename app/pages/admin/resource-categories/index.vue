<script setup lang="ts">
type ResourceTemplate = {
  id: number
  name: string
  key: string
  cardAspectRatio: string
}

type ResourceCategory = {
  id: number
  name: string
  slug: string
  description?: string
  templateId: number
  templateName?: string
  templateKey?: string
  allowLocal: boolean
  allowExternal: boolean
  allowCommercialExternal: boolean
  allowFileless: boolean
  alwaysModerateCreate: boolean
  alwaysModerateUpdate: boolean
  enableVersioning: boolean
  enableSupportUrl: boolean
  requirePrefix: boolean
  minTags: number
  parentCategoryId: number
  displayOrder: number
  resourcesCount: number
}

type ManageResponse = {
  success: boolean
  message?: string
  error?: string
}

type CategoryTreeItem = {
  label: string
  value: number
  children?: CategoryTreeItem[]
}

const { t } = useI18n()
const router = useRouter()

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
  ssr: false
})

useHead({
  title: () => t('admin.resource_categories_page.title')
})

const { data, refresh } = await useFetch<{
  templates: ResourceTemplate[]
  categories: ResourceCategory[]
}>('/api/admin/resource-categories/page')

const templates = computed(() => data.value?.templates ?? [])
const categories = computed(() => data.value?.categories ?? [])
const nameFilter = ref('')
const selectedCategoryId = ref<number | null>(null)
const isDeleting = ref(false)
const expandedCategoryTreeKeys = ref<string[]>([])
const categoryChevronTogglePending = ref(false)

function templateLabel(template: { key: string, name: string }) {
  const normalizedKey = template.key === 'square' ? 'grid' : template.key
  const translated = t(`admin.resource_templates.${normalizedKey}`)
  if (translated && translated !== `admin.resource_templates.${normalizedKey}`) return translated
  return template.name
}

function categoryTemplateLabel(category: ResourceCategory) {
  const byId = templates.value.find(tpl => tpl.id === category.templateId)
  if (byId) return templateLabel(byId)
  if (category.templateKey) {
    const normalizedKey = category.templateKey === 'square' ? 'grid' : category.templateKey
    const translated = t(`admin.resource_templates.${normalizedKey}`)
    if (translated && translated !== `admin.resource_templates.${normalizedKey}`) return translated
  }
  return category.templateName ?? String(category.templateId)
}

function categoryFeatureBadges(category: ResourceCategory) {
  const out: string[] = []
  if (category.allowLocal) out.push(t('admin.resource_categories_page.badge_local'))
  if (category.allowExternal) out.push(t('admin.resource_categories_page.badge_external'))
  if (category.allowCommercialExternal) out.push(t('admin.resource_categories_page.badge_purchase'))
  if (category.allowFileless) out.push(t('admin.resource_categories_page.badge_fileless'))
  if (category.enableVersioning) out.push(t('admin.resource_categories_page.badge_versioning'))
  if (category.enableSupportUrl) out.push(t('admin.resource_categories_page.badge_support'))
  return out
}

const categoryById = computed(() => {
  const map = new Map<number, ResourceCategory>()
  for (const category of categories.value) {
    map.set(category.id, category)
  }
  return map
})
const selectedCategory = computed(() => {
  if (selectedCategoryId.value === null) return null
  return categoryById.value.get(selectedCategoryId.value) ?? null
})

const categoryTreeItems = computed<CategoryTreeItem[]>(() => {
  const byParent = new Map<number, ResourceCategory[]>()
  for (const category of categories.value) {
    const parentId = Number(category.parentCategoryId ?? 0)
    const list = byParent.get(parentId) ?? []
    list.push(category)
    byParent.set(parentId, list)
  }

  const filterKeyword = nameFilter.value.trim().toLowerCase()
  const walk = (parentId: number): CategoryTreeItem[] => {
    const children = (byParent.get(parentId) ?? [])
      .slice()
      .sort((a, b) => (a.displayOrder - b.displayOrder) || a.name.localeCompare(b.name))

    const nodes: CategoryTreeItem[] = []
    for (const child of children) {
      const childNodes = walk(child.id)
      const matched = !filterKeyword
        || child.name.toLowerCase().includes(filterKeyword)
        || child.slug.toLowerCase().includes(filterKeyword)
      if (!matched && childNodes.length === 0) continue
      nodes.push({
        label: child.name,
        value: child.id,
        ...(childNodes.length ? { children: childNodes } : {})
      })
    }
    return nodes
  }

  return walk(0)
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
const visibleCategoryCount = computed(() => {
  const walkCount = (items: CategoryTreeItem[]): number => {
    let count = 0
    for (const item of items) {
      count += 1
      if (item.children?.length) count += walkCount(item.children)
    }
    return count
  }
  return walkCount(categoryTreeItems.value)
})
function onTreeSelect(item: unknown) {
  if (!item || typeof item !== 'object' || !('value' in item)) return
  const value = Number((item as { value: number }).value)
  if (Number.isFinite(value)) selectedCategoryId.value = value
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
watch(categoryTreeItems, () => {
  expandedCategoryTreeKeys.value = [...defaultExpandedCategoryTreeKeys.value]
}, { immediate: true })

function goCreate() {
  void router.push('/admin/resource-categories/create')
}

function goEdit(categoryId: number) {
  void router.push(`/admin/resource-categories/${categoryId}`)
}

const deleteCategory = ref<ResourceCategory | null>(null)
const isDeleteModalOpen = ref(false)

function openDelete(category: ResourceCategory) {
  deleteCategory.value = category
  isDeleteModalOpen.value = true
}

async function confirmDelete() {
  if (!deleteCategory.value) return
  isDeleting.value = true
  try {
    const res = await $fetch<ManageResponse>('/api/admin/resource-categories/manage', {
      method: 'POST',
      body: { intent: 'delete', categoryId: deleteCategory.value.id }
    })
    if (res.success) {
      isDeleteModalOpen.value = false
      if (selectedCategoryId.value === deleteCategory.value.id) {
        selectedCategoryId.value = null
      }
      await refresh()
    }
  } finally {
    isDeleting.value = false
    deleteCategory.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">
          {{ t('admin.resource_categories_page.title') }}
        </h2>
        <p class="text-(--ui-text-muted)">
          {{ t('admin.resource_categories_page.subtitle') }}
        </p>
      </div>
      <UButton
        color="primary"
        icon="i-lucide-plus"
        @click="goCreate"
      >
        {{ t('admin.resource_categories_page.add_category') }}
      </UButton>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-1.5 pt-2">
      <UInput
        v-model="nameFilter"
        class="max-w-sm"
        icon="i-lucide-search"
        :placeholder="t('admin.resource_categories_page.col_name')"
      />
      <p class="text-xs text-(--ui-text-muted)">
        {{ t('admin.resources_page.total', { total: visibleCategoryCount }) }}
      </p>
    </div>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <UCard :ui="{ body: 'p-2 sm:p-2' }">
        <template #header>
          <div class="text-sm font-semibold">
            {{ t('admin.resource_categories_page.title') }}
          </div>
        </template>
        <UEmpty
          v-if="visibleCategoryCount === 0"
          :title="t('common.noData')"
          :description="t('admin.resources_page.empty')"
        />
        <UTree
          v-else
          :expanded="expandedCategoryTreeKeys"
          :items="categoryTreeItems"
          :get-key="(item) => String(item.value)"
          @update:model-value="onTreeSelect"
          @update:expanded="onCategoryTreeExpandedUpdate"
        >
          <template #item-wrapper="{ item, expanded, handleToggle }">
            <div
              :class="[
                'relative group w-full flex items-center text-sm select-none before:absolute before:inset-y-px before:inset-x-0 before:z-[-1] before:rounded-md',
                'focus:outline-none focus-visible:outline-none focus-visible:before:ring-inset focus-visible:before:ring-2 focus-visible:before:ring-primary',
                'px-2.5 py-1.5 gap-1.5 transition-colors before:transition-colors',
                selectedCategoryId === item.value
                  ? 'before:bg-elevated text-primary'
                  : 'hover:text-highlighted hover:before:bg-elevated/50'
              ]"
              @click="onTreeSelect(item)"
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
      </UCard>

      <UCard>
        <template #header>
          <div class="text-sm font-semibold">
            {{ t('common.actions') }}
          </div>
        </template>
        <UEmpty
          v-if="!selectedCategory"
          :title="t('common.noData')"
          description="请选择左侧分类节点"
        />
        <div
          v-else
          class="space-y-4"
        >
          <div>
            <div class="text-base font-semibold text-(--ui-text-highlighted)">
              {{ selectedCategory.name }}
            </div>
            <div class="font-mono text-xs text-(--ui-text-muted)">
              {{ selectedCategory.slug }}
            </div>
          </div>

          <div class="text-sm text-(--ui-text-muted)">
            {{ t('admin.resource_categories_page.col_template') }}: {{ categoryTemplateLabel(selectedCategory) }}
          </div>
          <div class="text-sm text-(--ui-text-muted)">
            {{ t('admin.resource_categories_page.col_resources') }}: {{ selectedCategory.resourcesCount ?? 0 }}
          </div>

          <div class="flex flex-wrap gap-1">
            <template v-if="categoryFeatureBadges(selectedCategory).length">
              <span
                v-for="badge in categoryFeatureBadges(selectedCategory)"
                :key="badge"
                class="rounded border border-(--ui-border) bg-(--ui-bg-elevated) px-2 py-0.5 text-xs"
              >
                {{ badge }}
              </span>
            </template>
            <span
              v-else
              class="text-xs text-(--ui-text-muted)"
            >-</span>
          </div>

          <div class="flex justify-end gap-2 border-t border-(--ui-border) pt-3">
            <UButton
              color="neutral"
              variant="outline"
              @click="goEdit(selectedCategory.id)"
            >
              {{ t('admin.resource_categories_page.edit_category') }}
            </UButton>
            <UButton
              color="error"
              variant="outline"
              @click="openDelete(selectedCategory)"
            >
              {{ t('admin.resource_categories_page.delete_category') }}
            </UButton>
          </div>
        </div>
      </UCard>
    </div>

    <UModal
      v-model:open="isDeleteModalOpen"
      :ui="{ content: 'sm:max-w-md' }"
    >
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold leading-6 text-highlighted">
            {{ t('admin.resource_categories_page.delete_confirm_title') }}
          </h3>
          <p class="text-sm text-(--ui-text-muted) mt-2">
            {{ t('admin.resource_categories_page.delete_confirm_desc') }}
          </p>

          <div class="mt-6 flex justify-end gap-3">
            <UButton
              color="neutral"
              variant="ghost"
              @click="isDeleteModalOpen = false"
            >
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              color="error"
              :loading="isDeleting"
              @click="confirmDelete"
            >
              {{ t('common.confirm') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
