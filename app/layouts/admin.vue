<script setup lang="ts">
const { t } = useI18n()

const sidebarCollapsed = useState('geemc:admin-sidebar-collapsed', () => false)
const mobileOpen = useState('geemc:admin-mobile-open', () => false)
</script>

<template>
  <div class="flex min-h-screen flex-col bg-(--ui-bg)">
    <UHeader
      sticky
      class="z-50 border-b border-(--ui-border)"
      :ui="{ container: 'max-w-none px-4 sm:px-6' }"
      :toggle="false"
    >
      <template #left>
        <div class="-ml-2 flex h-full items-center">
          <UButton
            variant="ghost"
            color="neutral"
            icon="i-lucide-menu"
            class="md:hidden"
            @click="mobileOpen = true"
          />
          <UButton
            variant="ghost"
            color="neutral"
            icon="i-lucide-indent-decrease"
            class="hidden md:flex"
            :class="{ 'rotate-180': sidebarCollapsed }"
            @click="sidebarCollapsed = !sidebarCollapsed"
          />
          <NuxtLink
            to="/admin"
            class="ml-2 flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-(--ui-bg-elevated) sm:ml-3 sm:pr-3"
          >
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--ui-primary)/10 text-(--ui-primary)"
            >
              <UIcon
                name="i-lucide-layout-dashboard"
                class="size-[18px]"
              />
            </span>
            <span class="hidden min-w-0 sm:flex">
              <span class="truncate text-sm font-semibold text-(--ui-text-highlighted)">
                {{ t('admin.panel_title') }}
              </span>
            </span>
          </NuxtLink>
        </div>
      </template>

      <template #right>
        <div class="flex items-center gap-2">
          <UserNav />
        </div>
      </template>
    </UHeader>

    <div class="flex flex-1">
      <aside
        class="sticky top-[var(--header-height,64px)] hidden h-[calc(100vh-var(--header-height,64px))] shrink-0 flex-col overflow-y-auto border-r border-(--ui-border) bg-(--ui-bg-accented)/30 transition-all duration-300 ease-in-out md:flex"
        :class="[sidebarCollapsed ? 'w-16' : 'w-64']"
      >
        <div class="flex flex-1 flex-col p-2">
          <AdminSidebar :collapsed="sidebarCollapsed" />
        </div>
      </aside>

      <USlideover
        v-model:open="mobileOpen"
        side="left"
        class="md:hidden"
        :title="t('admin.mobile_menu_title')"
        :ui="{ content: 'w-[75vw] max-w-sm' }"
      >
        <template #content>
          <div class="h-full p-4">
            <AdminSidebar />
          </div>
        </template>
      </USlideover>

      <UMain class="min-w-0 flex-1 bg-(--ui-bg-muted)/30">
        <div class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 md:py-8 lg:px-8">
          <slot />
        </div>
      </UMain>
    </div>
  </div>
</template>

<style scoped>
aside {
  transition-property: width;
}
</style>
