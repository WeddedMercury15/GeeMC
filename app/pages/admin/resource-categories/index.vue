<script setup lang="ts">
import { getFilteredRowModel, getPaginationRowModel, getSortedRowModel } from '@tanstack/table-core'

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

type TableColumnApi = {
  getFilterValue: () => unknown
  setFilterValue: (value: unknown) => void
  toggleVisibility: (visible: boolean) => void
}

type TableColumnLike = {
  id: string | number
  getCanHide: () => boolean
  columnDef: { header: unknown }
  getIsVisible: () => boolean
}

type TableApi = {
  getColumn: (id: string | number) => TableColumnApi | undefined
  getAllColumns: () => TableColumnLike[]
  setPageIndex: (pageIndex: number) => void
  getState: () => { pagination: { pageIndex: number } }
}

type TableRef = {
  tableApi?: TableApi
}

const { t } = useI18n()

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
const table = useTemplateRef<TableRef>('table')
const columnFilters = ref([{ id: 'name', value: '' }])
const columnVisibility = ref({})
const rowSelection = ref({})
const sorting = ref([{ id: 'id', desc: false }])
const pagination = ref({ pageIndex: 0, pageSize: 10 })

const isCreateOpen = ref(false)
const isEditOpen = ref(false)
const isDeleting = ref(false)

const form = reactive<{
  name: string
  slug: string
  description: string
  templateId: number | undefined
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
}>({
  name: '',
  slug: '',
  description: '',
  templateId: undefined,
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
  displayOrder: 1
})

const editingId = ref<number | null>(null)

function templateLabel(template: { key: string, name: string }) {
  const translated = t(`admin.resource_templates.${template.key}`)
  if (translated && translated !== `admin.resource_templates.${template.key}`) return translated
  return template.name
}

function categoryTemplateLabel(category: ResourceCategory) {
  const byId = templates.value.find(tpl => tpl.id === category.templateId)
  if (byId) return templateLabel(byId)
  if (category.templateKey) {
    const translated = t(`admin.resource_templates.${category.templateKey}`)
    if (translated && translated !== `admin.resource_templates.${category.templateKey}`) return translated
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

const columns = [
  {
    accessorKey: 'name',
    header: t('admin.resource_categories_page.col_name'),
    cell: ({ row }: { row: { original: ResourceCategory } }) =>
      h('span', { class: 'font-medium text-(--ui-text-highlighted)' }, row.original.name)
  },
  {
    accessorKey: 'slug',
    header: t('admin.resource_categories_page.col_slug'),
    cell: ({ row }: { row: { original: ResourceCategory } }) =>
      h('span', { class: 'font-mono text-xs text-(--ui-text-muted)' }, row.original.slug)
  },
  {
    accessorKey: 'templateName',
    header: t('admin.resource_categories_page.col_template'),
    cell: ({ row }: { row: { original: ResourceCategory } }) => categoryTemplateLabel(row.original)
  },
  {
    accessorKey: 'resourcesCount',
    header: t('admin.resource_categories_page.col_resources'),
    cell: ({ row }: { row: { original: ResourceCategory } }) => row.original.resourcesCount ?? 0
  },
  {
    id: 'featureFlags',
    header: t('admin.resource_categories_page.col_features'),
    cell: ({ row }: { row: { original: ResourceCategory } }) => {
      const badges = categoryFeatureBadges(row.original)
      if (badges.length === 0) return '-'
      return h(
        'div',
        { class: 'flex flex-wrap gap-1' },
        badges.map(label => h('span', { class: 'px-2 py-0.5 text-xs rounded bg-(--ui-bg-elevated) border border-(--ui-border)' }, label))
      )
    }
  },
  {
    id: 'actions',
    header: t('common.actions'),
    cell: ({ row }: { row: { original: ResourceCategory } }) =>
      h(
        'div',
        { class: 'text-right' },
        h(
          resolveComponent('UDropdownMenu'),
          {
            content: { align: 'end' },
            items: [[
              { label: t('admin.resource_categories_page.edit_category'), icon: 'i-lucide-pencil', onSelect: () => openEdit(row.original) },
              { label: t('admin.resource_categories_page.delete_category'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => openDelete(row.original) }
            ]]
          },
          () =>
            h(resolveComponent('UButton'), {
              icon: 'i-lucide-ellipsis-vertical',
              color: 'neutral',
              variant: 'ghost'
            })
        )
      )
  }
]

const nameFilter = computed<string>({
  get: () => (table.value?.tableApi?.getColumn('name')?.getFilterValue() as string) || '',
  set: (value: string) => table.value?.tableApi?.getColumn('name')?.setFilterValue(value || undefined)
})

function resetForm() {
  form.name = ''
  form.slug = ''
  form.description = ''
  form.templateId = templates.value[0]?.id
  form.allowLocal = true
  form.allowExternal = true
  form.allowCommercialExternal = false
  form.allowFileless = true
  form.alwaysModerateCreate = false
  form.alwaysModerateUpdate = false
  form.enableVersioning = true
  form.enableSupportUrl = true
  form.requirePrefix = false
  form.minTags = 0
  form.parentCategoryId = 0
  form.displayOrder = 1
  editingId.value = null
}

watch(
  templates,
  () => {
    if (form.templateId === undefined && templates.value.length > 0) {
      form.templateId = templates.value[0]!.id
    }
  },
  { immediate: true }
)

function openCreate() {
  resetForm()
  isCreateOpen.value = true
}

function openEdit(category: ResourceCategory) {
  resetForm()
  editingId.value = category.id
  form.name = category.name
  form.slug = category.slug
  form.description = category.description ?? ''
  form.templateId = category.templateId
  form.allowLocal = category.allowLocal
  form.allowExternal = category.allowExternal
  form.allowCommercialExternal = category.allowCommercialExternal
  form.allowFileless = category.allowFileless
  form.alwaysModerateCreate = category.alwaysModerateCreate
  form.alwaysModerateUpdate = category.alwaysModerateUpdate
  form.enableVersioning = category.enableVersioning
  form.enableSupportUrl = category.enableSupportUrl
  form.requirePrefix = category.requirePrefix
  form.minTags = category.minTags
  form.parentCategoryId = category.parentCategoryId
  form.displayOrder = category.displayOrder
  isEditOpen.value = true
}

async function saveCreate() {
  if (form.templateId === undefined) return
  await manage('create')
}

async function saveEdit() {
  if (editingId.value == null) return
  if (form.templateId === undefined) return
  await manage('update')
}

async function manage(intent: 'create' | 'update') {
  const payload = {
    intent,
    categoryId: editingId.value ?? undefined,
    data: {
      name: form.name,
      slug: form.slug || undefined,
      description: form.description || undefined,
      templateId: form.templateId,
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

  const res = await $fetch<ManageResponse>('/api/admin/resource-categories/manage', {
    method: 'POST',
    body: payload
  })

  if (!res.success) {
    return
  }

  isCreateOpen.value = false
  isEditOpen.value = false
  await refresh()
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
        @click="openCreate"
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

      <UDropdownMenu
        :items="
          table?.tableApi
            ?.getAllColumns()
            .filter((column) => column.getCanHide())
            .map((column) => ({
              label: typeof column.columnDef.header === 'string' ? column.columnDef.header : String(column.id),
              type: 'checkbox' as const,
              checked: column.getIsVisible(),
              onUpdateChecked(checked: boolean) {
                table?.tableApi?.getColumn(column.id)?.toggleVisibility(!!checked)
              },
              onSelect(e?: Event) {
                e?.preventDefault()
              }
            }))
        "
        :content="{ align: 'end' }"
      >
        <UButton
          :label="t('AdminUsers.display')"
          color="neutral"
          variant="outline"
          trailing-icon="i-lucide-settings-2"
        />
      </UDropdownMenu>
    </div>

    <div class="overflow-x-auto border border-(--ui-border) rounded-lg">
      <UTable
        ref="table"
        v-model:column-filters="columnFilters"
        v-model:column-visibility="columnVisibility"
        v-model:row-selection="rowSelection"
        v-model:sorting="sorting"
        v-model:pagination="pagination"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        :get-sorted-row-model="getSortedRowModel()"
        :get-filtered-row-model="getFilteredRowModel()"
        :data="categories"
        :columns="columns"
        :ui="{
          root: 'overflow-visible',
          base: 'min-w-full border-separate border-spacing-0',
          thead: '[&>tr]:bg-(--ui-bg-accented)/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 whitespace-nowrap first:rounded-l-lg last:rounded-r-lg border-y border-(--ui-border) first:border-l last:border-r',
          td: 'whitespace-nowrap border-b border-(--ui-border)'
        }"
      />
    </div>

    <div class="flex items-center justify-end pt-2">
      <UPagination
        :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
        :items-per-page="pagination.pageSize"
        :total="categories.length"
        @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)"
      />
    </div>

    <UModal
      v-model:open="isCreateOpen"
      :title="t('admin.resource_categories_page.add_category')"
      :ui="{ content: 'sm:max-w-lg' }"
    >
      <template #content>
        <div class="p-4">
          <UForm
            :state="form"
            class="space-y-4"
            @submit.prevent="saveCreate"
          >
            <UFormField :label="t('admin.resource_categories_page.name')">
              <UInput v-model="form.name" />
            </UFormField>

            <UFormField :label="t('admin.resource_categories_page.slug')">
              <UInput v-model="form.slug" class="font-mono" />
            </UFormField>

            <UFormField :label="t('admin.resource_categories_page.description')">
              <UTextarea v-model="form.description" />
            </UFormField>

            <UFormField :label="t('admin.resource_categories_page.col_template')">
              <USelect
                v-model="form.templateId"
                :items="templates.map((tpl) => ({ value: tpl.id, label: templateLabel(tpl) }))"
                option-attribute="label"
                value-attribute="value"
              />
            </UFormField>
            <div class="grid grid-cols-2 gap-2">
              <UCheckbox v-model="form.allowLocal" label="allow_local" />
              <UCheckbox v-model="form.allowExternal" label="allow_external" />
              <UCheckbox v-model="form.allowCommercialExternal" label="allow_commercial_external" />
              <UCheckbox v-model="form.allowFileless" label="allow_fileless" />
              <UCheckbox v-model="form.alwaysModerateCreate" label="always_moderate_create" />
              <UCheckbox v-model="form.alwaysModerateUpdate" label="always_moderate_update" />
              <UCheckbox v-model="form.enableVersioning" label="enable_versioning" />
              <UCheckbox v-model="form.enableSupportUrl" label="enable_support_url" />
              <UCheckbox v-model="form.requirePrefix" label="require_prefix" />
            </div>
            <div class="grid grid-cols-3 gap-2">
              <UFormField label="min_tags">
                <UInput v-model.number="form.minTags" type="number" />
              </UFormField>
              <UFormField label="parent_category_id">
                <UInput v-model.number="form.parentCategoryId" type="number" />
              </UFormField>
              <UFormField label="display_order">
                <UInput v-model.number="form.displayOrder" type="number" />
              </UFormField>
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="ghost"
                @click="isCreateOpen = false"
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
        </div>
      </template>
    </UModal>

    <UModal
      :open="isEditOpen"
      :title="t('admin.resource_categories_page.edit_category')"
      :ui="{ content: 'sm:max-w-lg' }"
      @update:open="(val) => { if (!val) isEditOpen = false }"
    >
      <template #content>
        <div class="p-4">
          <UForm
            :state="form"
            class="space-y-4"
            @submit.prevent="saveEdit"
          >
            <UFormField :label="t('admin.resource_categories_page.name')">
              <UInput v-model="form.name" />
            </UFormField>

            <UFormField :label="t('admin.resource_categories_page.slug')">
              <UInput v-model="form.slug" class="font-mono" />
            </UFormField>

            <UFormField :label="t('admin.resource_categories_page.description')">
              <UTextarea v-model="form.description" />
            </UFormField>

            <UFormField :label="t('admin.resource_categories_page.col_template')">
              <USelect
                v-model="form.templateId"
                :items="templates.map((tpl) => ({ value: tpl.id, label: templateLabel(tpl) }))"
                option-attribute="label"
                value-attribute="value"
              />
            </UFormField>
            <div class="grid grid-cols-2 gap-2">
              <UCheckbox v-model="form.allowLocal" label="allow_local" />
              <UCheckbox v-model="form.allowExternal" label="allow_external" />
              <UCheckbox v-model="form.allowCommercialExternal" label="allow_commercial_external" />
              <UCheckbox v-model="form.allowFileless" label="allow_fileless" />
              <UCheckbox v-model="form.alwaysModerateCreate" label="always_moderate_create" />
              <UCheckbox v-model="form.alwaysModerateUpdate" label="always_moderate_update" />
              <UCheckbox v-model="form.enableVersioning" label="enable_versioning" />
              <UCheckbox v-model="form.enableSupportUrl" label="enable_support_url" />
              <UCheckbox v-model="form.requirePrefix" label="require_prefix" />
            </div>
            <div class="grid grid-cols-3 gap-2">
              <UFormField label="min_tags">
                <UInput v-model.number="form.minTags" type="number" />
              </UFormField>
              <UFormField label="parent_category_id">
                <UInput v-model.number="form.parentCategoryId" type="number" />
              </UFormField>
              <UFormField label="display_order">
                <UInput v-model.number="form.displayOrder" type="number" />
              </UFormField>
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="ghost"
                @click="isEditOpen = false"
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
        </div>
      </template>
    </UModal>

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

