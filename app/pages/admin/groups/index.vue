<script setup lang="ts">
import { getPaginationRowModel, getSortedRowModel, getFilteredRowModel } from '@tanstack/table-core'

function upperFirst(input: string): string {
  if (!input) return input
  return input.charAt(0).toUpperCase() + input.slice(1)
}

const { t } = useI18n()
const { getGroupName } = useGroupName()

useHead({
  title: t('AdminGroups.title')
})

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
  ssr: false
})

interface Group {
  id: number
  name: string
  slug: string
  description?: string
  isSystemDefault: boolean
  permissions?: string[] | string | null
  memberCount: number
}

interface PageData {
  groups: Group[]
  allPermissionKeys: string[]
  operatorPermissions: string[]
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
  getState: () => { pagination: { pageIndex: number } }
  setPageIndex: (pageIndex: number) => void
}

type TableRef = {
  tableApi?: TableApi
}

type GroupFormPayload = {
  id?: number
  name: string
  slug: string
  description?: string
  permissions: string[]
}

type ManageResponse = {
  success: boolean
  message?: string
  error?: string
}

function getErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const maybe = error as { data?: { message?: string } }
  return maybe.data?.message
}

const isCreateOpen = ref(false)
const editGroup = ref<Group | null>(null)
const isSubmitting = ref(false)
const toast = useToast()
const table = useTemplateRef<TableRef>('table')

const { data, refresh, status } = useFetch<PageData>('/api/admin/groups/page')
const items = computed<Group[]>(() => data.value?.groups || [])
const allPermissionKeys = computed<string[]>(() => data.value?.allPermissionKeys || [])
const operatorPermissions = computed<string[]>(() => data.value?.operatorPermissions || [])

const columnFilters = ref([{ id: 'name', value: '' }])
const columnVisibility = ref({})
const rowSelection = ref({})
const sorting = ref([{ id: 'id', desc: false }])
const pagination = ref({ pageIndex: 0, pageSize: 10 })

const isSystemDefault = (role: Group) => !!role.isSystemDefault

const columns = [
  {
    accessorKey: 'id',
    header: t('AdminUsers.id'),
    cell: ({ row }: { row: { original: Group } }) => h('span', { class: 'font-mono text-sm' }, row.original.id)
  },
  {
    accessorKey: 'name',
    header: t('AdminGroups.groupName'),
    cell: ({ row }: { row: { original: Group } }) => {
      const group = row.original
      return h('div', { class: 'flex items-center gap-2' }, [
        h(resolveComponent('UIcon'), { name: 'i-lucide-shield', class: 'w-4 h-4 text-muted/70' }),
        h('span', { class: 'font-medium text-highlighted' }, getGroupName(group.name, group.slug)),
        isSystemDefault(group)
          ? h(resolveComponent('UBadge'), { variant: 'subtle', size: 'sm' }, () => t('AdminGroups.systemDefault'))
          : null
      ])
    }
  },
  {
    accessorKey: 'memberCount',
    header: t('AdminGroups.members'),
    cell: ({ row }: { row: { original: Group } }) =>
      h(resolveComponent('UBadge'), { variant: 'subtle', color: 'neutral', class: 'rounded-full' }, () => row.original.memberCount)
  },
  {
    accessorKey: 'description',
    header: t('AdminGroups.groupDesc'),
    cell: ({ row }: { row: { original: Group } }) => h('span', { class: 'text-sm text-muted line-clamp-1' }, row.original.description || '-')
  },
  {
    id: 'actions',
    header: t('common.actions'),
    cell: ({ row }: { row: { original: Group } }) => {
      const group = row.original
      return h('div', { class: 'text-right' }, [
        h(
          resolveComponent('UDropdownMenu'),
          {
            content: { align: 'end' },
            items: [
              [
                { label: t('AdminGroups.editGroup'), icon: 'i-lucide-pencil', onSelect: () => (editGroup.value = group) },
                ...(!isSystemDefault(group)
                  ? [
                      {
                        label: t('AdminGroups.deleteGroup'),
                        icon: 'i-lucide-trash-2',
                        color: 'error',
                        onSelect: () => handleDeleteTrigger(group)
                      }
                    ]
                  : [])
              ]
            ]
          },
          () =>
            h(
              resolveComponent('UButton'),
              {
                icon: 'i-lucide-ellipsis-vertical',
                color: 'neutral',
                variant: 'ghost'
              },
              undefined
            )
        )
      ])
    }
  }
]

const isDeleteModalOpen = ref(false)
const deleteTarget = ref<Group | null>(null)

const nameFilter = computed<string>({
  get: (): string => (table.value?.tableApi?.getColumn('name')?.getFilterValue() as string) || '',
  set: (val: string) => table.value?.tableApi?.getColumn('name')?.setFilterValue(val || undefined)
})

async function handleManage(intent: string, payload: GroupFormPayload) {
  isSubmitting.value = true
  try {
    const res = await $fetch<ManageResponse>('/api/admin/groups/manage', {
      method: 'POST',
      body: {
        intent,
        groupId: payload.id,
        data: { name: payload.name, slug: payload.slug, description: payload.description, permissions: payload.permissions }
      }
    })

    if (res.success) {
      toast.add({ title: t(`AdminGroups.${res.message}`), color: 'success' })
      isCreateOpen.value = false
      editGroup.value = null
      refresh()
    } else {
      toast.add({ title: res.error || t('AdminGroups.deleteError'), color: 'error' })
    }
  } catch (error: unknown) {
    toast.add({ title: getErrorMessage(error) || t('AdminGroups.operationFailed'), color: 'error' })
  } finally {
    isSubmitting.value = false
  }
}

function handleDeleteTrigger(group: Group) {
  deleteTarget.value = group
  isDeleteModalOpen.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  isSubmitting.value = true
  try {
    const res = await $fetch<ManageResponse>('/api/admin/groups/manage', {
      method: 'POST',
      body: { intent: 'delete', groupId: deleteTarget.value.id }
    })

    if (res.success) {
      toast.add({ title: t('AdminGroups.deleteSuccess'), color: 'success' })
      isDeleteModalOpen.value = false
      refresh()
    } else {
      toast.add({ title: res.error || t('AdminGroups.deleteError'), color: 'error' })
    }
  } catch (error: unknown) {
    toast.add({ title: getErrorMessage(error) || t('AdminGroups.deleteError'), color: 'error' })
  } finally {
    isSubmitting.value = false
    deleteTarget.value = null
  }
}
</script>

<template>
  <div class="space-y-6 flex flex-col h-full">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">
          {{ t('AdminGroups.title') }}
        </h2>
        <p class="text-(--ui-text-muted)">
          {{ t('AdminGroups.description') }}
        </p>
      </div>
      <UButton
        icon="i-lucide-plus"
        @click="isCreateOpen = true"
      >
        {{ t('AdminGroups.addGroup') }}
      </UButton>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-1.5 pt-4">
      <UInput
        v-model="nameFilter"
        class="max-w-sm"
        icon="i-lucide-search"
        :placeholder="t('AdminGroups.groupName')"
      />

      <div class="flex flex-wrap items-center gap-1.5">
        <UDropdownMenu
          :items="
            table?.tableApi
              ?.getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => ({
                label: typeof column.columnDef.header === 'string'
                  ? column.columnDef.header
                  : upperFirst(String(column.id)),
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
    </div>

    <div class="flex-1 min-h-0 relative">
      <div class="overflow-x-auto border border-(--ui-border) rounded-lg">
        <UTable
          ref="table"
          v-model:column-filters="columnFilters"
          v-model:column-visibility="columnVisibility"
          v-model:row-selection="rowSelection"
          v-model:sorting="sorting"
          v-model:pagination="pagination"
          :pagination-options="{
            getPaginationRowModel: getPaginationRowModel()
          }"
          :get-sorted-row-model="getSortedRowModel()"
          :get-filtered-row-model="getFilteredRowModel()"
          :data="items"
          :columns="columns"
          :loading="status === 'pending'"
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
    </div>

    <div class="flex items-center justify-between gap-3 border-t border-(--ui-border) pt-4 mt-auto">
      <div class="text-sm text-(--ui-text-muted)">
        {{ t('AdminUsers.rowsSelected', { selected: Object.keys(rowSelection).length, total: items.length }) }}
      </div>

      <div class="flex items-center gap-1.5">
        <UPagination
          :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
          :items-per-page="pagination.pageSize"
          :total="items.length"
          @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)"
        />
      </div>
    </div>

    <UModal
      v-model:open="isCreateOpen"
      :title="t('AdminGroups.addGroup')"
    >
      <template #content>
        <div class="p-4">
          <AdminGroupForm
            :is-submitting="isSubmitting"
            :all-permission-keys="allPermissionKeys"
            :operator-permissions="operatorPermissions"
            @submit="handleManage('create', $event)"
            @cancel="isCreateOpen = false"
          />
        </div>
      </template>
    </UModal>

    <UModal
      :open="!!editGroup"
      :title="t('AdminGroups.editGroup')"
      @update:open="val => !val && (editGroup = null)"
    >
      <template #content>
        <div class="p-4">
          <AdminGroupForm
            v-if="editGroup"
            :initial-data="editGroup"
            :is-submitting="isSubmitting"
            :is-edit="true"
            :all-permission-keys="allPermissionKeys"
            :operator-permissions="operatorPermissions"
            @submit="handleManage('update', $event)"
            @cancel="editGroup = null"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteModalOpen"
      :ui="{ content: 'sm:max-w-md' }"
    >
      <template #content>
        <div class="p-6">
          <div class="flex items-start gap-4">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
              <UIcon name="i-lucide-triangle-alert" class="w-6 h-6 text-error" />
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold leading-6 text-highlighted mb-1">
                {{ t('AdminGroups.deleteConfirmTitle') }}
              </h3>
              <p class="text-sm text-(--ui-text-muted)">
                <template v-if="deleteTarget">
                  {{ t('AdminGroups.deleteConfirmDesc') }}
                  <span class="font-bold text-highlighted mt-2 block p-2 bg-(--ui-bg-accented)/50 rounded border border-(--ui-border)">
                    {{ getGroupName(deleteTarget.name, deleteTarget.slug) }}
                  </span>
                </template>
              </p>
            </div>
          </div>

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
              :loading="isSubmitting"
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
