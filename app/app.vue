<script setup lang="ts">
const { locale, t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()

watch(
  () => route.query.oauth_error,
  (err) => {
    if (!err || typeof err !== 'string') return
    toast.add({ title: t('auth.oauth_failed'), color: 'error' })
    const { oauth_error: _o, ...rest } = route.query
    void router.replace({ path: route.path, query: rest })
  },
  { immediate: true }
)

useHead(() => ({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: locale.value
  }
}))

const title = 'GeeMC'

useSeoMeta({
  title,
  ogTitle: title,
  ogImage: 'https://ui.nuxt.com/assets/templates/nuxt/starter-light.png',
  twitterImage: 'https://ui.nuxt.com/assets/templates/nuxt/starter-light.png',
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
