<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: 'admin',
  ssr: false
})

import type { DropdownMenuItem } from '@nuxt/ui'

const { t, locale } = useI18n()
const toast = useToast()

useHead({
  title: () => t('admin.users_page.title')
})

const pageSize = 20
const currentPage = ref(1)

type AdminUserRow = {
  id: number
  username: string
  createdAt: string
  geeLinked: boolean
  groups: string[]
}

type AdminUsersPageResponse = {
  items: AdminUserRow[]
  total: number
  page: number
  pageSize: number
}

const { data, pending } = await useAsyncData(
  'admin-users-page',
  () =>
    $fetch<AdminUsersPageResponse>(
      `/api/admin/users/page?page=${currentPage.value}&pageSize=${pageSize}`
    ),
  { watch: [currentPage] }
)

const totalCount = computed(() => data.value?.total ?? 0)
const items = computed((): AdminUserRow[] => data.value?.items ?? [])

const keyword = ref('')
const showGroups = ref(true)
const showGee = ref(true)
const showJoined = ref(true)

const filteredItems = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter((row) => {
    const groupText = row.groups.join(' ').toLowerCase()
    return row.username.toLowerCase().includes(q) || groupText.includes(q)
  })
})

const visibleColumnCount = computed(() =>
  1 + (showGroups.value ? 1 : 0) + (showGee.value ? 1 : 0) + (showJoined.value ? 1 : 0)
)

const tableColumnMenuItems = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: t('admin.users_page.col_groups'),
      type: 'checkbox',
      checked: showGroups.value,
      onUpdateChecked: (checked: boolean) => {
        showGroups.value = checked
      },
      onSelect: (e?: Event) => {
        e?.preventDefault()
      }
    },
    {
      label: t('admin.users_page.col_gee'),
      type: 'checkbox',
      checked: showGee.value,
      onUpdateChecked: (checked: boolean) => {
        showGee.value = checked
      },
      onSelect: (e?: Event) => {
        e?.preventDefault()
      }
    },
    {
      label: t('admin.users_page.col_joined'),
      type: 'checkbox',
      checked: showJoined.value,
      onUpdateChecked: (checked: boolean) => {
        showJoined.value = checked
      },
      onSelect: (e?: Event) => {
        e?.preventDefault()
      }
    }
  ]
])

function onAddUserClick() {
  toast.add({
    title: t('admin.users_page.add_user_todo'),
    color: 'neutral'
  })
}

function formatJoined(iso: string) {
  try {
    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(iso))
  } catch {
    return iso
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">
          {{ t('admin.users_page.title') }}
        </h2>
        <p class="text-(--ui-text-muted)">
          {{ t('admin.users_page.subtitle') }}
        </p>
      </div>
      <UButton
        icon="i-lucide-user-plus"
        @click="onAddUserClick"
      >
        {{ t('admin.users_page.add_user') }}
      </UButton>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
      <UInput
        v-model="keyword"
        class="w-full max-w-sm"
        icon="i-lucide-search"
        :placeholder="t('admin.users_page.search_placeholder')"
      />

      <UDropdownMenu
        :items="tableColumnMenuItems"
        :content="{ align: 'end' }"
      >
        <UButton
          :label="t('admin.users_page.display')"
          color="neutral"
          variant="outline"
          trailing-icon="i-lucide-settings-2"
        />
      </UDropdownMenu>
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-(--ui-border) bg-(--ui-bg-elevated)/50 text-(--ui-text-muted)">
            <tr>
              <th class="px-4 py-3 font-medium">
                {{ t('admin.users_page.col_user') }}
              </th>
              <th
                v-if="showGroups"
                class="hidden px-4 py-3 font-medium sm:table-cell"
              >
                {{ t('admin.users_page.col_groups') }}
              </th>
              <th
                v-if="showGee"
                class="hidden px-4 py-3 font-medium md:table-cell"
              >
                {{ t('admin.users_page.col_gee') }}
              </th>
              <th
                v-if="showJoined"
                class="px-4 py-3 font-medium"
              >
                {{ t('admin.users_page.col_joined') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending">
              <td
                :colspan="visibleColumnCount"
                class="px-4 py-8 text-center text-(--ui-text-muted)"
              >
                {{ t('admin.users_page.loading') }}
              </td>
            </tr>
            <tr
              v-else-if="filteredItems.length === 0"
            >
              <td
                :colspan="visibleColumnCount"
                class="px-4 py-8 text-center text-(--ui-text-muted)"
              >
                {{ t('admin.users_page.empty') }}
              </td>
            </tr>
            <tr
              v-for="row in filteredItems"
              :key="row.id"
              class="border-b border-(--ui-border) last:border-0"
            >
              <td class="px-4 py-3">
                <NuxtLink
                  :to="`/users/${row.id}`"
                  class="font-medium text-(--ui-primary) hover:underline"
                >
                  {{ row.username }}
                </NuxtLink>
                <p class="mt-1 text-xs text-(--ui-text-muted) sm:hidden">
                  {{ row.groups.length ? row.groups.join(', ') : '—' }}
                </p>
              </td>
              <td
                v-if="showGroups"
                class="hidden px-4 py-3 text-(--ui-text-muted) sm:table-cell"
              >
                {{ row.groups.length ? row.groups.join(', ') : '—' }}
              </td>
              <td
                v-if="showGee"
                class="hidden px-4 py-3 md:table-cell"
              >
                <UBadge
                  v-if="row.geeLinked"
                  color="success"
                  variant="subtle"
                  size="xs"
                >
                  {{ t('admin.users_page.gee_yes') }}
                </UBadge>
                <span
                  v-else
                  class="text-(--ui-text-muted)"
                >{{ t('admin.users_page.gee_no') }}</span>
              </td>
              <td
                v-if="showJoined"
                class="px-4 py-3 text-(--ui-text-muted)"
              >
                {{ formatJoined(row.createdAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <div
      v-if="totalCount > pageSize"
      class="flex justify-center"
    >
      <UPagination
        v-model:page="currentPage"
        :total="totalCount"
        :page-count="Math.ceil(totalCount / pageSize)"
      />
    </div>
  </div>
</template>
