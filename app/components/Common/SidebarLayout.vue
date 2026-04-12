<script setup lang="ts">
withDefaults(
  defineProps<{
    sidebarOpen?: boolean
  }>(),
  {
    sidebarOpen: true
  }
)
</script>

<template>
  <div class="flex flex-col lg:flex-row">
    <div class="flex-1 min-w-0 pb-8">
      <div>
        <slot />
      </div>
    </div>

    <aside
      class="hidden lg:flex flex-col border-l border-(--ui-border) bg-(--ui-bg-accented)/35 shrink-0 sticky top-[var(--header-height,64px)] h-[calc(100vh-var(--header-height,64px))] overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out"
      :class="sidebarOpen ? 'w-80 opacity-100 px-4 py-6' : 'w-0 opacity-0 border-none p-0 overflow-hidden'"
    >
      <div class="w-[288px] space-y-6">
        <div class="space-y-6">
          <slot name="sidebar" />
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
aside {
  transition-property: width, opacity, padding, transform;
  transition-duration: 300ms;
}
</style>
