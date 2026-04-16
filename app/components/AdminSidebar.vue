<script setup lang="ts">
const props = defineProps<{
  collapsed?: boolean
}>()

const { t } = useI18n()

const navigationItems = computed(() => [
  {
    label: t('admin.dashboard'),
    icon: 'i-lucide-layout-dashboard',
    to: '/admin',
    exact: true
  },
  {
    label: t('admin.users'),
    icon: 'i-lucide-users',
    to: '/admin/users'
  },
  {
    label: t('admin.groups'),
    icon: 'i-lucide-shield-user',
    to: '/admin/groups'
  }
])

const bottomItems = computed(() => [
  {
    label: t('admin.back_to_home'),
    icon: 'i-lucide-arrow-left',
    to: '/'
  }
])
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="min-h-0 flex-1 overflow-y-auto">
      <UNavigationMenu
        :collapsed="props.collapsed"
        :items="navigationItems"
        orientation="vertical"
        class="w-full"
        tooltip
        popover
        :ui="{
          link: ['cursor-pointer', props.collapsed ? 'justify-center p-2' : '']
        }"
      />
    </div>

    <div class="mt-auto shrink-0 pt-4">
      <UNavigationMenu
        :collapsed="props.collapsed"
        orientation="vertical"
        :items="bottomItems"
        class="w-full"
        tooltip
        :ui="{
          link: ['cursor-pointer', props.collapsed ? 'justify-center p-2' : '']
        }"
      />
    </div>
  </div>
</template>
