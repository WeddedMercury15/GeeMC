<script setup lang="ts">
const router = useRouter()
const toast = useToast()
const { t } = useI18n()

definePageMeta({
  middleware: 'auth'
})

type PublishCategory = {
  id: number
  name: string
  slug: string
  allowLocal: boolean
  allowExternal: boolean
  allowCommercialExternal: boolean
  allowFileless: boolean
  enableVersioning: boolean
}

type PublishField = {
  id: string
  title: string
  description: string
  displayGroup: string
  displayOrder: number
  fieldType: string
  fieldChoices: Record<string, string>
  required: boolean
  maxLength: number
  categoryIds: number[]
}

const { data } = await useFetch<{ categories: PublishCategory[], fields: PublishField[] }>('/api/resources/publish-meta')
const categories = computed(() => data.value?.categories ?? [])
const allFields = computed(() => data.value?.fields ?? [])

const form = reactive({
  title: '',
  tagLine: '',
  categoryId: 0,
  resourceType: 'download',
  edition: 'java',
  kind: 'mod',
  environment: 'both',
  description: '',
  cover: '',
  icon: '',
  supportUrl: '',
  externalUrl: '',
  externalPurchaseUrl: '',
  price: 0,
  currency: '',
  versionName: '1.0.0',
  versionType: 'release',
  size: '0 MB',
  gameVersionsRaw: '',
  loadersRaw: '',
  serverTypesRaw: ''
})

const customFields = reactive<Record<string, string>>({})
const submitting = ref(false)

const selectedCategory = computed(() => categories.value.find(c => c.id === Number(form.categoryId)) ?? null)

const resourceTypeOptions = computed(() => {
  const c = selectedCategory.value
  if (!c) return []
  const out: { label: string, value: string }[] = []
  if (c.allowLocal) out.push({ label: t('resources.publish.type_download'), value: 'download' })
  if (c.allowExternal) out.push({ label: t('resources.publish.type_external'), value: 'external' })
  if (c.allowCommercialExternal) out.push({ label: t('resources.publish.type_external_purchase'), value: 'external_purchase' })
  if (c.allowFileless) out.push({ label: t('resources.publish.type_fileless'), value: 'fileless' })
  return out
})

watch(selectedCategory, (c) => {
  if (!c) return
  if (!resourceTypeOptions.value.some(x => x.value === form.resourceType)) {
    form.resourceType = resourceTypeOptions.value[0]?.value ?? 'download'
  }
})

const fields = computed(() => {
  const cid = Number(form.categoryId)
  if (!cid) return []
  return allFields.value.filter(f => f.categoryIds.includes(cid))
})

function parseCsv(raw: string): string[] {
  return raw.split(',').map(x => x.trim()).filter(Boolean)
}

async function submit() {
  submitting.value = true
  try {
    const res = await $fetch<{ success: boolean, redirectTo: string }>('/api/resources/create', {
      method: 'POST',
      body: {
        ...form,
        gameVersions: parseCsv(form.gameVersionsRaw),
        loaders: parseCsv(form.loadersRaw),
        serverTypes: parseCsv(form.serverTypesRaw),
        supportUrl: form.supportUrl || undefined,
        externalUrl: form.externalUrl || undefined,
        externalPurchaseUrl: form.externalPurchaseUrl || undefined,
        currency: form.currency || undefined,
        customFields
      }
    })
    if (res.success) {
      await router.push(res.redirectTo)
      return
    }
  } catch {
    toast.add({ title: t('common.error'), description: t('resources.publish.failed'), color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UContainer class="py-6 max-w-3xl">
    <UCard>
      <template #header>
        <div class="font-semibold text-lg">{{ t('resources.publish_title') }}</div>
      </template>
      <div class="space-y-4">
        <UFormField :label="t('resources.publish.title')"><UInput v-model="form.title" /></UFormField>
        <UFormField :label="t('resources.publish.tagline')"><UInput v-model="form.tagLine" /></UFormField>
        <UFormField :label="t('resources.publish.category')">
          <USelect
            v-model="form.categoryId"
            :items="categories.map(c => ({ label: c.name, value: c.id }))"
            option-attribute="label"
            value-attribute="value"
          />
        </UFormField>
        <UFormField :label="t('resources.publish.type')">
          <USelect
            v-model="form.resourceType"
            :items="resourceTypeOptions"
            option-attribute="label"
            value-attribute="value"
          />
        </UFormField>
        <div class="grid grid-cols-3 gap-2">
          <UFormField :label="t('resources.publish.edition')"><UInput v-model="form.edition" /></UFormField>
          <UFormField :label="t('resources.publish.kind')"><UInput v-model="form.kind" /></UFormField>
          <UFormField :label="t('resources.publish.environment')"><UInput v-model="form.environment" /></UFormField>
        </div>
        <UFormField :label="t('resources.publish.description')"><UTextarea v-model="form.description" /></UFormField>
        <div class="grid grid-cols-2 gap-2">
          <UFormField :label="t('resources.publish.cover_url')"><UInput v-model="form.cover" /></UFormField>
          <UFormField :label="t('resources.publish.icon_url')"><UInput v-model="form.icon" /></UFormField>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <UFormField :label="t('resources.publish.version_name')"><UInput v-model="form.versionName" /></UFormField>
          <UFormField :label="t('resources.publish.version_type')">
            <USelect v-model="form.versionType" :items="[{ label: t('resources.version_type_release'), value: 'release' }, { label: t('resources.version_type_snapshot'), value: 'snapshot' }]" option-attribute="label" value-attribute="value" />
          </UFormField>
        </div>
        <UFormField :label="t('resources.publish.size')"><UInput v-model="form.size" /></UFormField>
        <UFormField :label="t('resources.publish.game_versions')"><UInput v-model="form.gameVersionsRaw" /></UFormField>
        <UFormField :label="t('resources.publish.loaders')"><UInput v-model="form.loadersRaw" /></UFormField>
        <UFormField :label="t('resources.publish.server_types')"><UInput v-model="form.serverTypesRaw" /></UFormField>

        <UFormField v-if="form.resourceType === 'external' || form.resourceType === 'external_purchase'" :label="t('resources.publish.external_url')">
          <UInput v-model="form.externalUrl" />
        </UFormField>
        <UFormField v-if="form.resourceType === 'external_purchase'" :label="t('resources.publish.purchase_url')">
          <UInput v-model="form.externalPurchaseUrl" />
        </UFormField>
        <div v-if="form.resourceType === 'external_purchase'" class="grid grid-cols-2 gap-2">
          <UFormField :label="t('resources.publish.price')"><UInput v-model.number="form.price" type="number" /></UFormField>
          <UFormField :label="t('resources.publish.currency')"><UInput v-model="form.currency" /></UFormField>
        </div>
        <UFormField :label="t('resources.publish.support_url')"><UInput v-model="form.supportUrl" /></UFormField>

        <div v-if="fields.length" class="space-y-3 pt-2 border-t border-(--ui-border)">
          <div class="font-medium">{{ t('resources.publish.custom_fields') }}</div>
          <UFormField v-for="f in fields" :key="f.id" :label="f.title" :description="f.description || undefined">
            <UInput v-model="customFields[f.id]" />
          </UFormField>
        </div>

        <div class="flex justify-end">
          <UButton color="primary" :loading="submitting" @click="submit">{{ t('resources.publish.submit') }}</UButton>
        </div>
      </div>
    </UCard>
  </UContainer>
</template>
