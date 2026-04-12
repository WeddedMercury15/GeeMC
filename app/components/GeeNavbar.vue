<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()

const homeRightSidebarOpen = useState<boolean>('homeRightSidebarOpen', () => false)
const homeRightSidebarDesktopOpen = useState<boolean>('homeRightSidebarDesktopOpen', () => true)

const links = computed(() => ([
  { label: t('nav.home'), to: '/' },
  { label: t('nav.resources'), to: '/resources' },
  { label: t('nav.forum'), to: '/forum' },
  { label: t('nav.wiki'), to: '#', disabled: true }
]))
</script>

<template>
  <UHeader
    class="sticky top-0 z-50"
    :ui="{ center: 'justify-center' }"
  >
    <template #left>
      <NuxtLink
        to="/"
        class="flex items-center gap-2"
      >
        <span class="font-black tracking-tight text-lg">{{ t('common.site_name') }}</span>
      </NuxtLink>
    </template>

    <UNavigationMenu
      :items="links"
      class="hidden md:flex"
    />

    <template #right>
      <UButton
        v-if="route.path === '/'"
        class="lg:hidden"
        :color="homeRightSidebarOpen ? 'primary' : 'neutral'"
        variant="ghost"
        icon="i-lucide-panel-right"
        @click="homeRightSidebarOpen = true"
      />

      <UButton
        v-if="route.path === '/'"
        class="hidden lg:flex"
        :color="homeRightSidebarDesktopOpen ? 'primary' : 'neutral'"
        variant="ghost"
        :icon="homeRightSidebarDesktopOpen ? 'i-lucide-panel-right-close' : 'i-lucide-panel-right-open'"
        @click="homeRightSidebarDesktopOpen = !homeRightSidebarDesktopOpen"
      />

      <UserNav />
    </template>
  </UHeader>
</template>
