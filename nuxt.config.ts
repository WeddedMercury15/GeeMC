// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/i18n'
  ],

  $production: {
    nitro: {
      externals: {
        inline: [
          /^(?!.*(mysql2|@libsql|drizzle-orm))/
        ],
        external: [
          'mysql2',
          '@libsql/client',
          '@libsql/win32-x64-msvc',
          '@libsql/darwin-x64',
          '@libsql/linux-x64-gnu',
          '@libsql/linux-arm64-gnu',
          '@libsql/linux-x64-musl'
        ]
      }
    }
  },

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  i18n: {
    defaultLocale: 'en-US',
    strategy: 'no_prefix',
    langDir: 'locales',
    locales: [
      { code: 'en-US', language: 'en-US', file: 'en-US.json', name: 'English' },
      { code: 'zh-CN', language: 'zh-Hans', file: 'zh-CN.json', name: '中文（简体）' }
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root'
    },
    compilation: {
      strictMessage: false
    }
  }
})
