<script setup lang="ts">
import type { ResourceDetail, ResourceVersion } from '~/utils/resourceCatalog'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()
const { formatTime } = useFormatTime()
const auth = useAuth()

definePageMeta({
  path: '/resources/:id(\\d+)'
})

const id = computed(() => String(route.params.id || ''))

const { data: resourceData, error: resourceError } = await useAsyncData(
  () => `resource-${route.params.category}-${id.value}`,
  () => $fetch<ResourceDetail>(`/api/resources/${id.value}`, { query: { includeDeleted: auth.canPublish.value ? '1' : '0' } })
)

if (resourceError.value || !resourceData.value) {
  throw createError({ statusCode: 404, statusMessage: 'Resource Not Found' })
}

const resource = computed(() => resourceData.value!)
const isOwner = computed(() => Number(auth.user.value?.id) === Number(resource.value?.authorUserId))
const teamMemberIds = computed(() => Array.isArray(resource.value?.teamMemberUserIds) ? resource.value.teamMemberUserIds : [])
const isTeamMember = computed(() => {
  const uid = Number(auth.user.value?.id ?? 0)
  if (!uid) return false
  return teamMemberIds.value.includes(uid)
})
const canManageResource = computed(() => auth.canPublish.value && (isOwner.value || isTeamMember.value))
const isManageMode = computed(() => route.query.manage === '1')
const showManageUi = computed(() => canManageResource.value && isManageMode.value)
const detailPath = computed(() => `/resources/${id.value}`)

const updateForm = reactive({
  title: '',
  versionString: '',
  updateType: 'update' as 'update' | 'release' | 'snapshot',
  message: ''
})
const submittingUpdate = ref(false)

const versionForm = reactive({
  name: '',
  type: 'release' as 'release' | 'snapshot',
  size: '0 MB',
  gameVersionsRaw: '',
  loadersRaw: '',
  serverTypesRaw: '',
  updateTitle: '',
  updateMessage: '',
  updateType: 'release' as 'update' | 'release' | 'snapshot'
})
const submittingVersion = ref(false)

const editDescOpen = ref(false)
const editDescText = ref('')
const submittingDesc = ref(false)

const editUpdateOpen = ref(false)
const editUpdateId = ref<number | null>(null)
const editUpdateForm = reactive({
  title: '',
  versionString: '',
  updateType: 'update' as 'update' | 'release' | 'snapshot',
  message: ''
})
const submittingEditUpdate = ref(false)

const deleteUpdateOpen = ref(false)
const deleteUpdateId = ref<number | null>(null)
const deletingUpdate = ref(false)
const resourceStateConfirmOpen = ref(false)
const resourceStateIntent = ref<'hide' | 'restore' | 'delete'>('hide')
const submittingResourceState = ref(false)
const teamMemberNamesInput = ref('')
const submittingTeamMembers = ref(false)
const mediaCoverInput = ref('')
const mediaIconInput = ref('')
const mediaSubmitting = ref(false)
const galleryNewUrl = ref('')
const galleryNewCaption = ref('')
const galleryEditing = ref<{ url: string, caption: string }[]>([])
const coverUploadInput = ref<HTMLInputElement | null>(null)
const iconUploadInput = ref<HTMLInputElement | null>(null)
const galleryUploadInput = ref<HTMLInputElement | null>(null)
const galleryUploadCaption = ref('')
const linkNewLabel = ref('')
const linkNewUrl = ref('')
const linkNewIcon = ref('i-lucide-link')
const linksEditing = ref<{ label: string, url: string, icon: string }[]>([])
const linksSubmitting = ref(false)
const basicEditOpen = ref(false)
const basicSubmitting = ref(false)
const basicForm = reactive({
  title: resource.value?.title ?? '',
  tagLine: resource.value?.tagLine ?? '',
  resourceType: (resource.value?.resourceType ?? 'download') as 'download' | 'external' | 'external_purchase' | 'fileless',
  supportUrl: resource.value?.supportUrl ?? '',
  externalUrl: resource.value?.externalUrl ?? '',
  externalPurchaseUrl: resource.value?.externalPurchaseUrl ?? '',
  price: Number(resource.value?.price ?? 0),
  currency: resource.value?.currency ?? '',
  tagsRaw: (resource.value?.tags ?? []).join(', ')
})

type ResourceMutationValidationError = {
  path?: string
  message?: string
}

const uploadVersionId = ref<number | null>(null)
const uploadFileInput = ref<HTMLInputElement | null>(null)
const pendingPickVersionId = ref<number | null>(null)
const uploadingFile = ref(false)
const fileActionLoading = ref<{ versionId: number, fileId: number, action: string } | null>(null)
const draggingVersionFile = ref<{ versionId: number, fileId: number } | null>(null)
const draftFileOrderByVersion = ref<Record<number, number[]>>({})
const selectedVersionFileIds = ref<Record<number, number[]>>({})
const bulkDeletingVersionId = ref<number | null>(null)

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function getResourceMutationErrorMessage(
  error: unknown,
  fallback: string,
  pathMap: Record<string, string> = {},
  statusMessageMap: Record<string, string> = {}
) {
  if (!error || typeof error !== 'object') return fallback

  const maybeError = error as {
    data?: {
      data?: {
        details?: ResourceMutationValidationError[]
      }
      message?: string
      statusMessage?: string
    }
    message?: string
    statusMessage?: string
  }

  const details = maybeError.data?.data?.details
  if (Array.isArray(details) && details.length > 0) {
    const first = details[0]
    const path = String(first?.path || '')
    const label = pathMap[path]
      || Object.entries(pathMap).find(([key]) => path === key || path.startsWith(`${key}.`))?.[1]
      || ''
    return label ? `${label}: ${first?.message || fallback}` : (first?.message || fallback)
  }

  const statusMessage = maybeError.data?.message || maybeError.data?.statusMessage || maybeError.statusMessage || maybeError.message
  if (!statusMessage) return fallback
  return statusMessageMap[statusMessage] || statusMessage
}

function validateBasicForm() {
  if (!basicForm.title.trim()) return t('validation.required_label', { label: t('resources.basic_title') })
  if (basicForm.supportUrl.trim() && !isHttpUrl(basicForm.supportUrl.trim())) return t('validation.invalid_format_label', { label: t('resources.basic_support_url') })

  if (basicForm.resourceType === 'external' || basicForm.resourceType === 'external_purchase') {
    if (!basicForm.externalUrl.trim()) return t('validation.required_label', { label: t('resources.basic_external_url') })
    if (!isHttpUrl(basicForm.externalUrl.trim())) return t('validation.invalid_format_label', { label: t('resources.basic_external_url') })
  }

  if (basicForm.externalPurchaseUrl.trim() && !isHttpUrl(basicForm.externalPurchaseUrl.trim())) {
    return t('validation.invalid_format_label', { label: t('resources.basic_purchase_url') })
  }

  if (basicForm.currency.trim().length > 8) return t('validation.max_length_label', { label: t('resources.basic_currency'), max: 8 })

  return null
}

function validateUpdateForm() {
  if (!updateForm.message.trim()) return t('validation.required_label', { label: t('resources.update_message') })
  if (updateForm.title.trim().length > 255) return t('validation.max_length_label', { label: t('resources.update_title'), max: 255 })
  if (updateForm.versionString.trim().length > 255) return t('validation.max_length_label', { label: t('resources.update_version'), max: 255 })
  return null
}

function validateEditUpdateForm() {
  if (!editUpdateForm.message.trim()) return t('validation.required_label', { label: t('resources.update_message') })
  if (editUpdateForm.title.trim().length > 255) return t('validation.max_length_label', { label: t('resources.update_title'), max: 255 })
  if (editUpdateForm.versionString.trim().length > 255) return t('validation.max_length_label', { label: t('resources.update_version'), max: 255 })
  return null
}

function validateVersionForm() {
  if (!versionForm.name.trim()) return t('validation.required_label', { label: t('resources.publish.version_name') })
  if (versionForm.name.trim().length > 255) return t('validation.max_length_label', { label: t('resources.publish.version_name'), max: 255 })
  if (!versionForm.size.trim()) return t('validation.required_label', { label: t('resources.publish.size') })
  if (versionForm.size.trim().length > 64) return t('validation.max_length_label', { label: t('resources.publish.size'), max: 64 })
  if (!versionForm.updateMessage.trim()) return t('validation.required_label', { label: t('resources.update_message') })
  if (versionForm.updateTitle.trim().length > 255) return t('validation.max_length_label', { label: t('resources.update_title'), max: 255 })
  return null
}

function validateDescriptionForm() {
  if (!editDescText.value.trim()) return t('validation.required_label', { label: t('resources.description') })
  return null
}

function validateTeamMembersForm(usernames: string[]) {
  if (usernames.length > 20) return t('validation.too_many_label', { label: t('resources.team_members'), max: 20 })
  return null
}

function validateUrlField(label: string, value: string, { required = false, maxLength = 2048 }: { required?: boolean, maxLength?: number } = {}) {
  const trimmed = value.trim()
  if (required && !trimmed) return t('validation.required_label', { label })
  if (!trimmed) return null
  if (trimmed.length > maxLength) return t('validation.max_length_label', { label, max: maxLength })
  if (!isHttpUrl(trimmed)) return t('validation.invalid_format_label', { label })
  return null
}

function validateGalleryBulkItems() {
  for (const item of galleryEditing.value) {
    const urlMessage = validateUrlField(t('resources.gallery_image_url'), String(item.url || ''), { required: true })
    if (urlMessage) return urlMessage
    if (String(item.caption || '').trim().length > 255) return t('validation.max_length_label', { label: t('resources.gallery_caption'), max: 255 })
  }
  return null
}

function validateLinksBulkItems() {
  for (const item of linksEditing.value) {
    if (!String(item.label || '').trim()) return t('validation.required_label', { label: t('resources.link_label') })
    if (String(item.label || '').trim().length > 255) return t('validation.max_length_label', { label: t('resources.link_label'), max: 255 })
    const urlMessage = validateUrlField(t('resources.link_url'), String(item.url || ''), { required: true })
    if (urlMessage) return urlMessage
    if (!String(item.icon || '').trim()) return t('validation.required_label', { label: t('resources.link_icon') })
    if (String(item.icon || '').trim().length > 255) return t('validation.max_length_label', { label: t('resources.link_icon'), max: 255 })
  }
  return null
}

function validateReasonInput(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed) return t('validation.required_label', { label })
  if (trimmed.length > 500) return t('validation.max_length_label', { label, max: 500 })
  return null
}

function validateReviewForm() {
  if (!reviewForm.content.trim()) return t('validation.required_label', { label: t('resources.field_review_content') })
  if (reviewForm.content.trim().length > 5000) return t('validation.max_length_label', { label: t('resources.field_review_content'), max: 5000 })
  return null
}

function getDetailStateErrorMessage(error: unknown, fallback: string) {
  return getResourceMutationErrorMessage(error, fallback, {
    intent: t('admin.notifications_page.field_action'),
    reason: t('admin.resources_page.field_reason')
  })
}

function getMediaMutationErrorMessage(error: unknown, fallback: string) {
  return getResourceMutationErrorMessage(error, fallback, {
    cover: t('resources.media_cover_url'),
    icon: t('resources.media_icon_url'),
    url: t('resources.gallery_image_url'),
    caption: t('resources.gallery_caption'),
    items: t('resources.gallery_manage')
  }, {
    'Missing url': t('resources.error_missing_image_url'),
    'Missing id': t('resources.error_missing_image'),
    'Missing id(s)': t('resources.error_missing_image')
  })
}

function getLinksMutationErrorMessage(error: unknown, fallback: string) {
  return getResourceMutationErrorMessage(error, fallback, {
    label: t('resources.link_label'),
    url: t('resources.link_url'),
    icon: t('resources.link_icon'),
    id: t('resources.related_links'),
    ids: t('resources.related_links'),
    items: t('resources.related_links')
  }, {
    'Missing fields': t('resources.error_missing_required_fields'),
    'Missing id(s)': t('resources.error_missing_link')
  })
}

function getReviewMutationErrorMessage(error: unknown, fallback: string) {
  return getResourceMutationErrorMessage(error, fallback, {
    rating: t('resources.review_filter_rating'),
    content: t('resources.field_review_content'),
    message: t('resources.field_reply_content'),
    reason: t('resources.field_report_reason')
  }, {
    'Resource is not reviewable': t('resources.error_resource_not_reviewable'),
    'Managers cannot review this resource': t('resources.error_managers_cannot_review'),
    'Managers cannot report this review': t('resources.error_managers_cannot_report_review'),
    'Managers cannot report this update': t('resources.error_managers_cannot_report_update'),
    'Managers cannot report this version': t('resources.error_managers_cannot_report_version'),
    'Cannot report your own review': t('resources.error_cannot_report_own_review'),
    'Review action is rate-limited, try again later': t('resources.error_rate_limited')
  })
}

function isFileActionLoading(versionId: number, fileId: number) {
  const v = fileActionLoading.value
  return !!v && Number(v.versionId) === Number(versionId) && Number(v.fileId) === Number(fileId)
}

function validateUploadFile(params: {
  file: File
  maxBytes: number
  kind: 'any' | 'image'
}) {
  if (!params.file || params.file.size <= 0) {
    toast.add({ title: t('common.error'), description: t('resources.upload_empty_file'), color: 'error' })
    return false
  }
  if (params.file.size > params.maxBytes) {
    toast.add({ title: t('common.error'), description: t('resources.upload_file_too_large'), color: 'error' })
    return false
  }
  if (params.kind === 'image' && !params.file.type.startsWith('image/')) {
    toast.add({ title: t('common.error'), description: t('resources.upload_image_only'), color: 'error' })
    return false
  }
  return true
}

async function readImageDimensions(file: File): Promise<{ width: number, height: number } | null> {
  if (!file.type.startsWith('image/')) return null
  const objectUrl = URL.createObjectURL(file)
  try {
    const size = await new Promise<{ width: number, height: number }>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 })
      img.onerror = () => reject(new Error('image_load_failed'))
      img.src = objectUrl
    })
    return size
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function validateImageGeometry(params: {
  file: File
  minWidth: number
  minHeight: number
  requireSquare?: boolean
}) {
  const dims = await readImageDimensions(params.file)
  if (!dims || dims.width <= 0 || dims.height <= 0) {
    toast.add({ title: t('common.error'), description: t('resources.upload_image_read_failed'), color: 'error' })
    return false
  }
  if (dims.width < params.minWidth || dims.height < params.minHeight) {
    toast.add({
      title: t('common.error'),
      description: t('resources.upload_image_too_small', { width: params.minWidth, height: params.minHeight }),
      color: 'error'
    })
    return false
  }
  if (params.requireSquare) {
    const diff = Math.abs(dims.width - dims.height)
    if (diff > Math.max(2, Math.round(Math.min(dims.width, dims.height) * 0.02))) {
      toast.add({ title: t('common.error'), description: t('resources.upload_image_square_required'), color: 'error' })
      return false
    }
  }
  return true
}

function resolveApiErrorMessage(error: unknown, fallback: string) {
  const e = error as any
  const fromData
    = (typeof e?.data?.statusMessage === 'string' && e.data.statusMessage)
      || (typeof e?.data?.message === 'string' && e.data.message)
  if (fromData) return fromData
  const fromStatus = typeof e?.statusMessage === 'string' ? e.statusMessage : ''
  if (fromStatus) return fromStatus
  return fallback
}

function getVersionFileActionErrorMessage(error: unknown, fallback: string) {
  return getResourceMutationErrorMessage(error, fallback, {
    action: t('admin.notifications_page.field_action'),
    fileId: t('resources.error_missing_file_id'),
    displayName: t('resources.upload_file'),
    orderedIds: t('resources.error_missing_order_data'),
    id: t('resources.error_missing_file_id'),
    ids: t('resources.error_missing_file_id')
  }, {
    'Missing fields': t('resources.error_missing_required_fields'),
    'Missing fileId': t('resources.error_missing_file_id'),
    'Missing orderedIds': t('resources.error_missing_order_data'),
    'Missing id(s)': t('resources.error_missing_file_id'),
    'Missing file': t('resources.error_missing_file'),
    'Empty file': t('validation.required_label', { label: t('resources.upload_file') }),
    'file too large': t('resources.error_file_too_large'),
    'File not found': t('resources.error_file_not_found')
  })
}

function pickFileForVersion(versionId: number) {
  pendingPickVersionId.value = versionId
  uploadFileInput.value?.click()
}

async function uploadVersionFile(versionId: number) {
  if (!canManageResource.value) return
  if (!resource.value?.id) return
  const el = uploadFileInput.value
  const file = el?.files?.[0]
  if (!file) return
  if (!validateUploadFile({ file, maxBytes: 200 * 1024 * 1024, kind: 'any' })) return
  uploadVersionId.value = versionId
  uploadingFile.value = true
  try {
    const form = new FormData()
    form.append('file', file)
    await $fetch(`/api/resources/${resource.value.id}/versions/${versionId}/files/upload`, {
      method: 'POST',
      body: form
    })
    if (el) el.value = ''
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.file_uploaded'), color: 'success' })
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: getVersionFileActionErrorMessage(error, t('resources.file_upload_failed')),
      color: 'error'
    })
  } finally {
    uploadingFile.value = false
    uploadVersionId.value = null
  }
}

async function onPickedVersionFile() {
  const vid = pendingPickVersionId.value
  pendingPickVersionId.value = null
  if (!vid) return
  await uploadVersionFile(vid)
}

async function deleteVersionFile(versionId: number, fileId: number) {
  if (!canManageResource.value) return
  if (!resource.value?.id) return
  if (!confirm(t('resources.file_delete_confirm'))) return
  fileActionLoading.value = { versionId, fileId, action: 'delete' }
  uploadingFile.value = true
  try {
    await $fetch(`/api/resources/${resource.value.id}/versions/${versionId}/files/delete`, {
      method: 'POST',
      body: { id: fileId }
    })
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.file_deleted'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: getVersionFileActionErrorMessage(error, t('resources.file_delete_failed')), color: 'error' })
  } finally {
    uploadingFile.value = false
    fileActionLoading.value = null
  }
}

async function downloadVersionFile(versionId: number, fileId: number) {
  if (!resource.value?.id) return
  fileActionLoading.value = { versionId, fileId, action: 'download' }
  try {
    const res = await $fetch<{ success: boolean, url: string }>(`/api/resources/${resource.value.id}/versions/${versionId}/files/${fileId}/download`, { method: 'POST' })
    downloadsCount.value = (downloadsCount.value || 0) + 1
    if (res?.url) await navigateTo(res.url, { external: true })
  } catch {
    toast.add({ title: t('common.error'), description: t('resources.download_failed'), color: 'error' })
  } finally {
    fileActionLoading.value = null
  }
}

async function setPrimaryVersionFile(versionId: number, fileId: number) {
  if (!canManageResource.value) return
  if (!resource.value?.id) return
  fileActionLoading.value = { versionId, fileId, action: 'primary' }
  try {
    await $fetch(`/api/resources/${resource.value.id}/versions/${versionId}/files/manage`, {
      method: 'POST',
      body: { action: 'set_primary', fileId }
    })
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
  } catch (error) {
    toast.add({ title: t('common.error'), description: getVersionFileActionErrorMessage(error, t('resources.file_primary_failed')), color: 'error' })
  } finally {
    fileActionLoading.value = null
  }
}

async function renameVersionFile(versionId: number, fileId: number, currentName: string) {
  if (!canManageResource.value) return
  if (!resource.value?.id) return
  const next = prompt(t('resources.file_rename_prompt'), currentName)
  if (!next?.trim()) return
  if (next.trim().length > 255) {
    toast.add({ title: t('common.error'), description: t('validation.max_length_label', { label: t('resources.upload_file'), max: 255 }), color: 'error' })
    return
  }
  fileActionLoading.value = { versionId, fileId, action: 'rename' }
  try {
    await $fetch(`/api/resources/${resource.value.id}/versions/${versionId}/files/manage`, {
      method: 'POST',
      body: { action: 'rename', fileId, displayName: next.trim() }
    })
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
  } catch (error) {
    toast.add({ title: t('common.error'), description: getVersionFileActionErrorMessage(error, t('resources.file_rename_failed')), color: 'error' })
  } finally {
    fileActionLoading.value = null
  }
}

async function moveVersionFile(version: ResourceVersion, fileId: number, direction: 'up' | 'down') {
  if (!canManageResource.value) return
  if (!resource.value?.id) return
  const files = [...(version.files || [])]
  const idx = files.findIndex(f => Number(f.id) === Number(fileId))
  if (idx < 0) return
  const target = direction === 'up' ? idx - 1 : idx + 1
  if (target < 0 || target >= files.length) return
  const a = files[idx]
  const b = files[target]
  if (!a || !b) return
  files[idx] = b
  files[target] = a
  try {
    await $fetch(`/api/resources/${resource.value.id}/versions/${version.id}/files/manage`, {
      method: 'POST',
      body: { action: 'reorder', orderedIds: files.map(f => Number(f.id)) }
    })
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
  } catch (error) {
    toast.add({ title: t('common.error'), description: getVersionFileActionErrorMessage(error, t('resources.file_reorder_failed')), color: 'error' })
  }
}

function canMoveVersionFile(version: ResourceVersion, fileId: number, direction: 'up' | 'down') {
  const files = version.files || []
  const idx = files.findIndex(f => Number(f.id) === Number(fileId))
  if (idx < 0) return false
  if (direction === 'up') return idx > 0
  return idx < files.length - 1
}

function getVersionFiles(version: ResourceVersion) {
  const files = version.files || []
  const draft = draftFileOrderByVersion.value[Number(version.id)] || []
  if (!draft.length) return files
  if (draft.length !== files.length) return files
  const map = new Map(files.map(f => [Number(f.id), f]))
  const ordered = draft
    .map(id => map.get(Number(id)))
    .filter((f): f is NonNullable<typeof files[number]> => Boolean(f))
  return ordered.length === files.length ? ordered : files
}

function setDraftOrder(version: ResourceVersion, orderedIds: number[]) {
  draftFileOrderByVersion.value = {
    ...draftFileOrderByVersion.value,
    [Number(version.id)]: orderedIds
  }
}

function clearDraftOrder(versionId: number) {
  const next = { ...draftFileOrderByVersion.value }
  delete next[Number(versionId)]
  draftFileOrderByVersion.value = next
}

function onVersionFileDragStart(versionId: number, fileId: number) {
  draggingVersionFile.value = { versionId: Number(versionId), fileId: Number(fileId) }
}

function onVersionFileDragOver(event: DragEvent) {
  event.preventDefault()
}

function onVersionFileDrop(version: ResourceVersion, targetFileId: number) {
  const dragging = draggingVersionFile.value
  draggingVersionFile.value = null
  if (!dragging) return
  if (Number(dragging.versionId) !== Number(version.id)) return
  const files = getVersionFiles(version)
  const from = files.findIndex(f => Number(f.id) === Number(dragging.fileId))
  const to = files.findIndex(f => Number(f.id) === Number(targetFileId))
  if (from < 0 || to < 0 || from === to) return
  const next = [...files]
  const moving = next[from]
  if (!moving) return
  next.splice(from, 1)
  next.splice(to, 0, moving)
  setDraftOrder(version, next.map(f => Number(f.id)))
}

async function saveVersionFileOrder(version: ResourceVersion) {
  if (!canManageResource.value || !resource.value?.id) return
  const orderedIds = draftFileOrderByVersion.value[Number(version.id)] || []
  if (orderedIds.length <= 1) return
  uploadingFile.value = true
  try {
    await $fetch(`/api/resources/${resource.value.id}/versions/${version.id}/files/manage`, {
      method: 'POST',
      body: { action: 'reorder', orderedIds }
    })
    clearDraftOrder(Number(version.id))
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.file_reordered'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: getVersionFileActionErrorMessage(error, t('resources.file_reorder_failed')), color: 'error' })
  } finally {
    uploadingFile.value = false
  }
}

function isVersionFileSelected(versionId: number, fileId: number) {
  return (selectedVersionFileIds.value[Number(versionId)] || []).includes(Number(fileId))
}

function selectedFilesCount(versionId: number) {
  return (selectedVersionFileIds.value[Number(versionId)] || []).length
}

function toggleVersionFileSelected(versionId: number, fileId: number, checked: boolean | string) {
  const key = Number(versionId)
  const set = new Set((selectedVersionFileIds.value[key] || []).map(v => Number(v)))
  if (checked) set.add(Number(fileId))
  else set.delete(Number(fileId))
  selectedVersionFileIds.value = { ...selectedVersionFileIds.value, [key]: Array.from(set) }
}

function toggleAllVersionFiles(version: ResourceVersion, checked: boolean | string) {
  const key = Number(version.id)
  const files = getVersionFiles(version)
  selectedVersionFileIds.value = {
    ...selectedVersionFileIds.value,
    [key]: checked ? files.map(f => Number(f.id)) : []
  }
}

async function bulkDeleteVersionFiles(versionId: number) {
  if (!canManageResource.value || !resource.value?.id) return
  const ids = (selectedVersionFileIds.value[Number(versionId)] || []).map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0)
  if (!ids.length) return
  if (!confirm(t('resources.file_delete_selected_confirm', { count: ids.length }))) return
  bulkDeletingVersionId.value = Number(versionId)
  uploadingFile.value = true
  try {
    await $fetch(`/api/resources/${resource.value.id}/versions/${versionId}/files/delete`, {
      method: 'POST',
      body: { ids }
    })
    selectedVersionFileIds.value = { ...selectedVersionFileIds.value, [Number(versionId)]: [] }
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.file_deleted_selected'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: getVersionFileActionErrorMessage(error, t('resources.file_delete_failed')), color: 'error' })
  } finally {
    bulkDeletingVersionId.value = null
    uploadingFile.value = false
  }
}

const replaceFileInput = ref<HTMLInputElement | null>(null)
const replacePending = ref<{ versionId: number, fileId: number } | null>(null)

function pickReplaceFile(versionId: number, fileId: number) {
  replacePending.value = { versionId, fileId }
  replaceFileInput.value?.click()
}

async function onPickedReplaceFile() {
  const pending = replacePending.value
  replacePending.value = null
  if (!pending || !resource.value?.id) return
  const file = replaceFileInput.value?.files?.[0]
  if (!file) return
  if (!validateUploadFile({ file, maxBytes: 200 * 1024 * 1024, kind: 'any' })) return
  fileActionLoading.value = { versionId: pending.versionId, fileId: pending.fileId, action: 'replace' }
  uploadingFile.value = true
  try {
    const form = new FormData()
    form.append('file', file)
    await $fetch(`/api/resources/${resource.value.id}/versions/${pending.versionId}/files/${pending.fileId}/replace`, {
      method: 'POST',
      body: form
    })
    if (replaceFileInput.value) replaceFileInput.value.value = ''
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.file_replaced'), color: 'success' })
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: getVersionFileActionErrorMessage(error, t('resources.file_replace_failed')),
      color: 'error'
    })
  } finally {
    uploadingFile.value = false
    fileActionLoading.value = null
  }
}

function formatBytes(bytes: number) {
  const n = Number(bytes ?? 0)
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exp = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  const value = n / Math.pow(1024, exp)
  const fixed = exp === 0 ? 0 : (value >= 10 ? 1 : 2)
  return `${value.toFixed(fixed)} ${units[exp]}`
}

const isResourceVisible = computed(() => (resource.value?.resourceState ?? 'visible') === 'visible')
const isResourceDeleted = computed(() => (resource.value?.resourceState ?? 'visible') === 'deleted')

async function restoreUpdate(updateId: number | undefined) {
  if (!canManageResource.value) return
  const idNum = Number(updateId)
  if (!Number.isFinite(idNum) || idNum <= 0) return
  try {
    await $fetch(`/api/resources/${id.value}/updates/${idNum}/restore`, { method: 'POST' })
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.update_restored'), color: 'success' })
  } catch {
    toast.add({ title: t('common.error'), description: t('resources.update_restore_failed'), color: 'error' })
  }
}

async function reportUpdate(updateId: number | undefined) {
  const idNum = Number(updateId)
  if (!Number.isFinite(idNum) || idNum <= 0) return
  if (!auth.isLoggedIn.value) {
    toast.add({ title: t('common.error'), description: t('resources.update_report_login_required'), color: 'error' })
    return
  }
  const reason = window.prompt(t('resources.update_report_prompt'))
  if (!reason || !reason.trim()) return
  const validationMessage = validateReasonInput(reason, t('resources.field_report_reason'))
  if (validationMessage) {
    toast.add({ title: t('common.error'), description: validationMessage, color: 'error' })
    return
  }
  try {
    await $fetch(`/api/resources/${id.value}/updates/${idNum}/report`, {
      method: 'POST',
      body: { reason: reason.trim() }
    })
    toast.add({ title: t('common.success'), description: t('resources.update_reported'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: getReviewMutationErrorMessage(error, t('resources.update_report_failed')), color: 'error' })
  }
}

async function reportVersion(versionId: number | undefined) {
  const idNum = Number(versionId)
  if (!Number.isFinite(idNum) || idNum <= 0) return
  if (!auth.isLoggedIn.value) {
    toast.add({ title: t('common.error'), description: t('resources.version_report_login_required'), color: 'error' })
    return
  }
  const reason = window.prompt(t('resources.version_report_prompt'))
  if (!reason || !reason.trim()) return
  const validationMessage = validateReasonInput(reason, t('resources.field_report_reason'))
  if (validationMessage) {
    toast.add({ title: t('common.error'), description: validationMessage, color: 'error' })
    return
  }
  try {
    await $fetch(`/api/resources/${id.value}/versions/${idNum}/report`, {
      method: 'POST',
      body: { reason: reason.trim() }
    })
    toast.add({ title: t('common.success'), description: t('resources.version_reported'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: getReviewMutationErrorMessage(error, t('resources.version_report_failed')), color: 'error' })
  }
}

async function voteUpdate(updateId: number | undefined) {
  const idNum = Number(updateId)
  if (!Number.isFinite(idNum) || idNum <= 0) return
  if (!auth.isLoggedIn.value) {
    toast.add({ title: t('common.error'), description: t('resources.update_vote_login_required'), color: 'error' })
    return
  }
  try {
    await $fetch(`/api/resources/${id.value}/updates/${idNum}/vote`, { method: 'POST' })
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
  } catch {
    toast.add({ title: t('common.error'), description: t('resources.update_vote_failed'), color: 'error' })
  }
}

function openResourceStateConfirm(intent: 'hide' | 'restore' | 'delete') {
  if (!showManageUi.value) return
  resourceStateIntent.value = intent
  resourceStateConfirmOpen.value = true
}

const resourceStateConfirmTitle = computed(() => {
  if (resourceStateIntent.value === 'hide') return t('resources.hide_resource')
  if (resourceStateIntent.value === 'restore') return t('resources.restore_resource')
  return t('resources.delete_resource')
})

const resourceStateConfirmDesc = computed(() => {
  if (resourceStateIntent.value === 'hide') return t('resources.hide_resource_confirm')
  if (resourceStateIntent.value === 'restore') return t('resources.restore_resource_confirm')
  return t('resources.delete_resource_confirm')
})

async function submitResourceStateChange() {
  if (!canManageResource.value) return
  submittingResourceState.value = true
  try {
    await $fetch(`/api/resources/${id.value}/state/manage`, {
      method: 'POST',
      body: { intent: resourceStateIntent.value }
    })
    resourceStateConfirmOpen.value = false
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.resource_state_updated'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: getDetailStateErrorMessage(error, t('resources.resource_state_update_failed')), color: 'error' })
  } finally {
    submittingResourceState.value = false
  }
}

watchEffect(() => {
  editDescText.value = resource.value?.descriptionHtml ?? ''
})

watchEffect(() => {
  mediaCoverInput.value = resource.value?.cover ?? ''
  mediaIconInput.value = resource.value?.icon ?? ''
  galleryEditing.value = (resource.value?.gallery ?? []).map(g => ({ url: g.url, caption: g.caption }))
  linksEditing.value = (resource.value?.links ?? []).map(l => ({ label: l.label, url: l.url, icon: l.icon }))
  basicForm.title = resource.value?.title ?? ''
  basicForm.tagLine = resource.value?.tagLine ?? ''
  basicForm.resourceType = (resource.value?.resourceType ?? 'download') as any
  basicForm.supportUrl = resource.value?.supportUrl ?? ''
  basicForm.externalUrl = resource.value?.externalUrl ?? ''
  basicForm.externalPurchaseUrl = resource.value?.externalPurchaseUrl ?? ''
  basicForm.price = Number(resource.value?.price ?? 0)
  basicForm.currency = resource.value?.currency ?? ''
  basicForm.tagsRaw = (resource.value?.tags ?? []).join(', ')
})

async function saveCover() {
  if (!canManageResource.value) return
  const validationMessage = validateUrlField(t('resources.media_cover_url'), mediaCoverInput.value, { required: true })
  if (validationMessage) {
    toast.add({ title: t('common.error'), description: validationMessage, color: 'error' })
    return
  }
  mediaSubmitting.value = true
  try {
    await $fetch(`/api/resources/${id.value}/media/cover.update`, { method: 'POST', body: { cover: mediaCoverInput.value } })
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.media_saved'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: getMediaMutationErrorMessage(error, t('resources.media_save_failed')), color: 'error' })
  } finally {
    mediaSubmitting.value = false
  }
}

async function uploadCover() {
  if (!canManageResource.value) return
  const file = coverUploadInput.value?.files?.[0]
  if (!file) return
  if (!validateUploadFile({ file, maxBytes: 10 * 1024 * 1024, kind: 'image' })) return
  if (!await validateImageGeometry({ file, minWidth: 640, minHeight: 320 })) return
  mediaSubmitting.value = true
  try {
    const form = new FormData()
    form.append('file', file)
    const res = await $fetch<{ success: boolean, url: string }>('/api/resources/' + id.value + '/media/cover.upload', { method: 'POST', body: form })
    mediaCoverInput.value = res.url
    if (coverUploadInput.value) coverUploadInput.value.value = ''
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.media_uploaded'), color: 'success' })
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: resolveApiErrorMessage(error, t('resources.media_upload_failed')),
      color: 'error'
    })
  } finally {
    mediaSubmitting.value = false
  }
}

async function saveIcon() {
  if (!canManageResource.value) return
  const validationMessage = validateUrlField(t('resources.media_icon_url'), mediaIconInput.value, { required: true })
  if (validationMessage) {
    toast.add({ title: t('common.error'), description: validationMessage, color: 'error' })
    return
  }
  mediaSubmitting.value = true
  try {
    await $fetch(`/api/resources/${id.value}/media/icon.update`, { method: 'POST', body: { icon: mediaIconInput.value } })
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.media_saved'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: getMediaMutationErrorMessage(error, t('resources.media_save_failed')), color: 'error' })
  } finally {
    mediaSubmitting.value = false
  }
}

async function uploadIcon() {
  if (!canManageResource.value) return
  const file = iconUploadInput.value?.files?.[0]
  if (!file) return
  if (!validateUploadFile({ file, maxBytes: 5 * 1024 * 1024, kind: 'image' })) return
  if (!await validateImageGeometry({ file, minWidth: 64, minHeight: 64, requireSquare: true })) return
  mediaSubmitting.value = true
  try {
    const form = new FormData()
    form.append('file', file)
    const res = await $fetch<{ success: boolean, url: string }>('/api/resources/' + id.value + '/media/icon.upload', { method: 'POST', body: form })
    mediaIconInput.value = res.url
    if (iconUploadInput.value) iconUploadInput.value.value = ''
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.media_uploaded'), color: 'success' })
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: resolveApiErrorMessage(error, t('resources.media_upload_failed')),
      color: 'error'
    })
  } finally {
    mediaSubmitting.value = false
  }
}

async function uploadGallery() {
  if (!canManageResource.value) return
  const file = galleryUploadInput.value?.files?.[0]
  if (!file) return
  if (!validateUploadFile({ file, maxBytes: 10 * 1024 * 1024, kind: 'image' })) return
  if (!await validateImageGeometry({ file, minWidth: 320, minHeight: 180 })) return
  mediaSubmitting.value = true
  try {
    const form = new FormData()
    form.append('file', file)
    form.append('caption', galleryUploadCaption.value || '')
    await $fetch('/api/resources/' + id.value + '/media/gallery.upload', { method: 'POST', body: form })
    galleryUploadCaption.value = ''
    if (galleryUploadInput.value) galleryUploadInput.value.value = ''
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.gallery_saved'), color: 'success' })
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: resolveApiErrorMessage(error, t('resources.gallery_save_failed')),
      color: 'error'
    })
  } finally {
    mediaSubmitting.value = false
  }
}
async function addGalleryItem() {
  if (!canManageResource.value) return
  const urlMessage = validateUrlField(t('resources.gallery_image_url'), galleryNewUrl.value, { required: true })
  if (urlMessage) {
    toast.add({ title: t('common.error'), description: urlMessage, color: 'error' })
    return
  }
  if (galleryNewCaption.value.trim().length > 255) {
    toast.add({ title: t('common.error'), description: t('validation.max_length_label', { label: t('resources.gallery_caption'), max: 255 }), color: 'error' })
    return
  }
  mediaSubmitting.value = true
  try {
    await $fetch(`/api/resources/${id.value}/media/gallery.manage`, {
      method: 'POST',
      body: { action: 'add', url: galleryNewUrl.value.trim(), caption: galleryNewCaption.value.trim() || undefined }
    })
    galleryNewUrl.value = ''
    galleryNewCaption.value = ''
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.gallery_saved'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: getMediaMutationErrorMessage(error, t('resources.gallery_save_failed')), color: 'error' })
  } finally {
    mediaSubmitting.value = false
  }
}

async function saveGalleryBulk() {
  if (!canManageResource.value) return
  const validationMessage = validateGalleryBulkItems()
  if (validationMessage) {
    toast.add({ title: t('common.error'), description: validationMessage, color: 'error' })
    return
  }
  mediaSubmitting.value = true
  try {
    await $fetch(`/api/resources/${id.value}/media/gallery.manage`, {
      method: 'POST',
      body: { action: 'bulk_replace', items: galleryEditing.value.map(g => ({ url: g.url, caption: g.caption || undefined })) }
    })
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.gallery_saved'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: getMediaMutationErrorMessage(error, t('resources.gallery_save_failed')), color: 'error' })
  } finally {
    mediaSubmitting.value = false
  }
}

async function addLinkItem() {
  if (!canManageResource.value) return
  if (!linkNewLabel.value.trim()) {
    toast.add({ title: t('common.error'), description: t('validation.required_label', { label: t('resources.link_label') }), color: 'error' })
    return
  }
  if (linkNewLabel.value.trim().length > 255) {
    toast.add({ title: t('common.error'), description: t('validation.max_length_label', { label: t('resources.link_label'), max: 255 }), color: 'error' })
    return
  }
  const urlMessage = validateUrlField(t('resources.link_url'), linkNewUrl.value, { required: true })
  if (urlMessage) {
    toast.add({ title: t('common.error'), description: urlMessage, color: 'error' })
    return
  }
  if (!linkNewIcon.value.trim()) {
    toast.add({ title: t('common.error'), description: t('validation.required_label', { label: t('resources.link_icon') }), color: 'error' })
    return
  }
  linksSubmitting.value = true
  try {
    await $fetch(`/api/resources/${id.value}/links/manage`, {
      method: 'POST',
      body: { action: 'add', label: linkNewLabel.value.trim(), url: linkNewUrl.value.trim(), icon: linkNewIcon.value.trim() || 'i-lucide-link' }
    })
    linkNewLabel.value = ''
    linkNewUrl.value = ''
    linkNewIcon.value = 'i-lucide-link'
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.links_saved'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: getLinksMutationErrorMessage(error, t('resources.links_save_failed')), color: 'error' })
  } finally {
    linksSubmitting.value = false
  }
}

async function saveLinksBulk() {
  if (!canManageResource.value) return
  const validationMessage = validateLinksBulkItems()
  if (validationMessage) {
    toast.add({ title: t('common.error'), description: validationMessage, color: 'error' })
    return
  }
  linksSubmitting.value = true
  try {
    await $fetch(`/api/resources/${id.value}/links/manage`, {
      method: 'POST',
      body: { action: 'bulk_replace', items: linksEditing.value.map(l => ({ label: l.label, url: l.url, icon: l.icon })) }
    })
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.links_saved'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: getLinksMutationErrorMessage(error, t('resources.links_save_failed')), color: 'error' })
  } finally {
    linksSubmitting.value = false
  }
}

function parseTagsRaw(raw: string) {
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

async function saveBasic() {
  if (!canManageResource.value) return
  const validationMessage = validateBasicForm()
  if (validationMessage) {
    toast.add({ title: t('common.error'), description: validationMessage, color: 'error' })
    return
  }
  basicSubmitting.value = true
  try {
    await $fetch(`/api/resources/${id.value}/basic/manage`, {
      method: 'POST',
      body: {
        title: basicForm.title,
        tagLine: basicForm.tagLine,
        resourceType: basicForm.resourceType,
        supportUrl: basicForm.supportUrl.trim() || undefined,
        externalUrl: basicForm.externalUrl.trim() || undefined,
        externalPurchaseUrl: basicForm.externalPurchaseUrl.trim() || undefined,
        price: basicForm.price || 0,
        currency: basicForm.currency.trim() || undefined,
        tags: parseTagsRaw(basicForm.tagsRaw)
      }
    })
    basicEditOpen.value = false
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.basic_saved'), color: 'success' })
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: getResourceMutationErrorMessage(error, t('resources.basic_save_failed'), {
        title: t('resources.basic_title'),
        tagLine: t('resources.basic_tagline'),
        supportUrl: t('resources.basic_support_url'),
        externalUrl: t('resources.basic_external_url'),
        externalPurchaseUrl: t('resources.basic_purchase_url'),
        price: t('resources.basic_price'),
        currency: t('resources.basic_currency'),
        tags: t('resources.basic_tags')
      }, {
        'Invalid category': t('resources.basic_save_failed'),
        'Category does not allow local download resources': t('resources.error_category_no_local'),
        'Category does not allow external resources': t('resources.error_category_no_external'),
        'Category does not allow paid external resources': t('resources.error_category_no_paid_external'),
        'Category does not allow fileless resources': t('resources.error_category_no_fileless')
      }),
      color: 'error'
    })
  } finally {
    basicSubmitting.value = false
  }
}
async function submitUpdate() {
  if (!canManageResource.value) return
  const validationMessage = validateUpdateForm()
  if (validationMessage) {
    toast.add({ title: t('common.error'), description: validationMessage, color: 'error' })
    return
  }
  submittingUpdate.value = true
  try {
    await $fetch(`/api/resources/${id.value}/updates/create`, {
      method: 'POST',
      body: { ...updateForm }
    })
    updateForm.title = ''
    updateForm.versionString = ''
    updateForm.updateType = 'update'
    updateForm.message = ''
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.update_published'), color: 'success' })
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: getResourceMutationErrorMessage(error, t('resources.update_publish_failed'), {
        title: t('resources.update_title'),
        versionString: t('resources.update_version'),
        updateType: t('resources.update_type'),
        message: t('resources.update_message')
      }),
      color: 'error'
    })
  } finally {
    submittingUpdate.value = false
  }
}

function openEditUpdate(log: any) {
  if (!showManageUi.value) return
  editUpdateId.value = Number(log?.id)
  editUpdateForm.title = log?.title ?? ''
  editUpdateForm.versionString = log?.version ?? ''
  editUpdateForm.updateType = (log?.updateType === 'snapshot' ? 'snapshot' : (log?.updateType === 'release' ? 'release' : 'update'))
  editUpdateForm.message = log?.message ?? ''
  editUpdateOpen.value = true
}

async function submitEditUpdate() {
  if (!canManageResource.value) return
  if (!editUpdateId.value) return
  const validationMessage = validateEditUpdateForm()
  if (validationMessage) {
    toast.add({ title: t('common.error'), description: validationMessage, color: 'error' })
    return
  }
  submittingEditUpdate.value = true
  try {
    await $fetch(`/api/resources/${id.value}/updates/${editUpdateId.value}/update`, {
      method: 'POST',
      body: {
        title: editUpdateForm.title,
        versionString: editUpdateForm.versionString,
        updateType: editUpdateForm.updateType,
        message: editUpdateForm.message
      }
    })
    editUpdateOpen.value = false
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.update_saved'), color: 'success' })
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: getResourceMutationErrorMessage(error, t('resources.update_save_failed'), {
        title: t('resources.update_title'),
        versionString: t('resources.update_version'),
        updateType: t('resources.update_type'),
        message: t('resources.update_message')
      }, {
        'Update is not editable': t('resources.error_update_not_editable'),
        'Description updates are immutable': t('resources.error_description_update_immutable')
      }),
      color: 'error'
    })
  } finally {
    submittingEditUpdate.value = false
  }
}

function openDeleteUpdate(updateId: number | undefined) {
  if (!showManageUi.value) return
  const idNum = Number(updateId)
  if (!Number.isFinite(idNum) || idNum <= 0) return
  deleteUpdateId.value = idNum
  deleteUpdateOpen.value = true
}

async function confirmDeleteUpdate() {
  if (!canManageResource.value) return
  if (!deleteUpdateId.value) return
  deletingUpdate.value = true
  try {
    await $fetch(`/api/resources/${id.value}/updates/${deleteUpdateId.value}/delete`, { method: 'POST' })
    deleteUpdateOpen.value = false
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.update_deleted'), color: 'success' })
  } catch {
    toast.add({ title: t('common.error'), description: t('resources.update_delete_failed'), color: 'error' })
  } finally {
    deletingUpdate.value = false
    deleteUpdateId.value = null
  }
}

function parseCsv(raw: string): string[] {
  return raw.split(',').map(x => x.trim()).filter(Boolean)
}

async function submitVersion() {
  if (!canManageResource.value) return
  const validationMessage = validateVersionForm()
  if (validationMessage) {
    toast.add({ title: t('common.error'), description: validationMessage, color: 'error' })
    return
  }
  submittingVersion.value = true
  try {
    await $fetch(`/api/resources/${id.value}/versions/create`, {
      method: 'POST',
      body: {
        name: versionForm.name,
        type: versionForm.type,
        size: versionForm.size,
        gameVersions: parseCsv(versionForm.gameVersionsRaw),
        loaders: parseCsv(versionForm.loadersRaw),
        serverTypes: parseCsv(versionForm.serverTypesRaw),
        updateTitle: versionForm.updateTitle,
        updateMessage: versionForm.updateMessage,
        updateType: versionForm.updateType
      }
    })
    versionForm.name = ''
    versionForm.type = 'release'
    versionForm.size = '0 MB'
    versionForm.gameVersionsRaw = ''
    versionForm.loadersRaw = ''
    versionForm.serverTypesRaw = ''
    versionForm.updateTitle = ''
    versionForm.updateMessage = ''
    versionForm.updateType = 'release'
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.version_published'), color: 'success' })
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: getResourceMutationErrorMessage(error, t('resources.version_publish_failed'), {
        name: t('resources.publish.version_name'),
        type: t('resources.version_type_release'),
        size: t('resources.publish.size'),
        gameVersions: t('resources.publish.game_versions'),
        loaders: t('resources.publish.loaders'),
        serverTypes: t('resources.publish.server_types'),
        updateTitle: t('resources.update_title'),
        updateMessage: t('resources.update_message'),
        updateType: t('resources.update_type')
      }),
      color: 'error'
    })
  } finally {
    submittingVersion.value = false
  }
}

async function submitDescription() {
  if (!canManageResource.value) return
  const validationMessage = validateDescriptionForm()
  if (validationMessage) {
    toast.add({ title: t('common.error'), description: validationMessage, color: 'error' })
    return
  }
  submittingDesc.value = true
  try {
    await $fetch(`/api/resources/${id.value}/description/update`, {
      method: 'POST',
      body: { message: editDescText.value }
    })
    editDescOpen.value = false
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.description_saved'), color: 'success' })
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: getResourceMutationErrorMessage(error, t('resources.description_save_failed'), {
        message: t('resources.description')
      }),
      color: 'error'
    })
  } finally {
    submittingDesc.value = false
  }
}

const tabItems = computed(() => [
  { label: t('resources.tab_description'), value: 'description' },
  { label: t('resources.tab_gallery'), value: 'gallery' },
  { label: t('resources.tab_versions'), value: 'versions' },
  { label: t('resources.tab_changelog'), value: 'changelog' },
  { label: t('resources.tab_reviews', { count: resource.value.reviews.length }), value: 'reviews' }
])

const versionTypeItems = computed(() => [
  { label: t('resources.version_type_all'), value: 'all' },
  { label: t('resources.version_type_release'), value: 'release' },
  { label: t('resources.version_type_snapshot'), value: 'snapshot' }
])

const versionTypeLabel = (type: 'release' | 'snapshot') =>
  type === 'release' ? t('resources.version_type_release') : t('resources.version_type_snapshot')

function taxonomyEditionLabel(ed: string) {
  const k = `resources.taxonomy.edition_${ed}`
  const tr = t(k)
  return tr !== k ? tr : ed
}

function taxonomyKindLabel(ed: string, kind: string) {
  const key = `resources.taxonomy.kind_${ed}_${kind}`
  const tr = t(key)
  return tr !== key ? tr : kind
}

function taxonomyEnvLabel(env: string) {
  const k = `resources.taxonomy.environment_${env}`
  const tr = t(k)
  return tr !== k ? tr : env
}

const isJavaMod = computed(
  () => resource.value?.taxonomy.edition === 'java' && resource.value?.taxonomy.kind === 'mod'
)
const isJavaPlugin = computed(
  () => resource.value?.taxonomy.edition === 'java' && resource.value?.taxonomy.kind === 'plugin'
)
const isDownloadableResource = computed(() => resource.value?.resourceType === 'download')
const isExternalResource = computed(() => resource.value?.resourceType === 'external')
const isExternalPurchaseResource = computed(() => resource.value?.resourceType === 'external_purchase')
const isFilelessResource = computed(() => resource.value?.resourceType === 'fileless')

const activeTab = ref<'description' | 'gallery' | 'versions' | 'changelog' | 'reviews'>('description')

function closeAllDetailModals() {
  downloadModalOpen.value = false
  editDescOpen.value = false
  editUpdateOpen.value = false
  deleteUpdateOpen.value = false
  resourceStateConfirmOpen.value = false
  basicEditOpen.value = false
}

function openBasicEditModal() {
  if (!showManageUi.value) return
  basicEditOpen.value = true
}

function openEditDescriptionModal() {
  if (!showManageUi.value) return
  editDescOpen.value = true
}

async function applyRouteTabAndHash() {
  const tab = typeof route.query.tab === 'string' ? route.query.tab : ''
  if (tab === 'description' || tab === 'gallery' || tab === 'versions' || tab === 'changelog' || tab === 'reviews') {
    activeTab.value = tab
  }
  await nextTick()
  const hash = typeof route.hash === 'string' ? route.hash : ''
  if (hash && hash.startsWith('#')) {
    const el = document.getElementById(hash.slice(1))
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

onMounted(() => {
  void applyRouteTabAndHash()
  if (resource.value?.id) {
    // fire-and-forget view tracking
    $fetch(`/api/resources/${resource.value.id}/view`, { method: 'POST' }).catch(() => {})
  }
})

watch(
  () => [route.query.tab, route.hash],
  () => {
    void applyRouteTabAndHash()
  }
)

watch(
  () => route.fullPath,
  () => {
    closeAllDetailModals()
  }
)

watch(
  showManageUi,
  (enabled) => {
    if (!enabled) {
      editDescOpen.value = false
      editUpdateOpen.value = false
      deleteUpdateOpen.value = false
      resourceStateConfirmOpen.value = false
      basicEditOpen.value = false
    }
  }
)

const versionType = ref<'all' | 'release' | 'snapshot'>('all')
const filterGameVersion = ref<string>('')
const filterLoader = ref<string>('')
const filterServerType = ref<string>('')

const isFollowed = ref(Boolean(resource.value?.isFollowed))
const followersCount = ref(Number(resource.value?.followers ?? 0))
const downloadsCount = ref(Number(resource.value?.downloads ?? 0))
const downloadModalOpen = ref(false)
const reviewSubmitting = ref(false)
const reviewForm = reactive({
  rating: 5,
  content: ''
})
const reviewReplyForms = reactive<Record<number, string>>({})

const quickGameVersion = ref('')
const quickLoader = ref('')
const quickServerType = ref('')

const canSubmitReview = computed(() => {
  if (!auth.isLoggedIn.value) return false
  if (!resource.value?.id) return false
  if (canManageResource.value) return false
  return true
})

const hasOwnReview = computed(() => {
  const uid = Number(auth.user.value?.id ?? 0)
  if (!uid) return false
  return resource.value.reviews.some(r => Number(r.userId) === uid)
})

function canDeleteReview(reviewUserId: number) {
  if (!auth.isLoggedIn.value) return false
  const currentUserId = Number(auth.user.value?.id ?? 0)
  if (!currentUserId) return false
  return currentUserId === Number(reviewUserId) || canManageResource.value || auth.canAdmin.value
}

watchEffect(() => {
  const names = (resource.value?.teamMembers ?? []).map(m => m.username)
  teamMemberNamesInput.value = names.join(', ')
})

async function saveTeamMembers() {
  if (!isOwner.value && !auth.canAdmin.value) return
  const usernames = teamMemberNamesInput.value
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
  const validationMessage = validateTeamMembersForm(usernames)
  if (validationMessage) {
    toast.add({ title: t('common.error'), description: validationMessage, color: 'error' })
    return
  }
  submittingTeamMembers.value = true
  try {
    await $fetch(`/api/resources/${id.value}/team/manage`, {
      method: 'POST',
      body: { usernames }
    })
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.team_members_saved'), color: 'success' })
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: getResourceMutationErrorMessage(error, t('resources.team_members_save_failed'), {
        usernames: t('resources.team_members')
      }),
      color: 'error'
    })
  } finally {
    submittingTeamMembers.value = false
  }
}

async function submitReview() {
  if (!canSubmitReview.value) return
  const validationMessage = validateReviewForm()
  if (validationMessage) {
    toast.add({ title: t('common.error'), description: validationMessage, color: 'error' })
    return
  }
  reviewSubmitting.value = true
  try {
    await $fetch(`/api/resources/${id.value}/reviews/create`, {
      method: 'POST',
      body: {
        rating: reviewForm.rating,
        content: reviewForm.content.trim()
      }
    })
    reviewForm.content = ''
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.review_saved'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: getReviewMutationErrorMessage(error, t('resources.review_save_failed')), color: 'error' })
  } finally {
    reviewSubmitting.value = false
  }
}

async function likeReview(reviewId: number) {
  if (!auth.isLoggedIn.value) {
    toast.add({ title: t('common.error'), description: t('resources.review_like_login_required'), color: 'error' })
    return
  }
  try {
    await $fetch(`/api/resources/${id.value}/reviews/${reviewId}/like`, { method: 'POST' })
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
  } catch {
    toast.add({ title: t('common.error'), description: t('resources.review_like_failed'), color: 'error' })
  }
}

async function deleteReview(reviewId: number) {
  try {
    await $fetch(`/api/resources/${id.value}/reviews/${reviewId}/delete`, { method: 'POST' })
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.review_deleted'), color: 'success' })
  } catch {
    toast.add({ title: t('common.error'), description: t('resources.review_delete_failed'), color: 'error' })
  }
}

async function restoreReview(reviewId: number) {
  try {
    await $fetch(`/api/resources/${id.value}/reviews/${reviewId}/restore`, { method: 'POST' })
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.review_restored'), color: 'success' })
  } catch {
    toast.add({ title: t('common.error'), description: t('resources.review_restore_failed'), color: 'error' })
  }
}

async function reportReview(reviewId: number) {
  if (!auth.isLoggedIn.value) {
    toast.add({ title: t('common.error'), description: t('resources.review_report_login_required'), color: 'error' })
    return
  }
  const reason = window.prompt(t('resources.review_report_prompt'))
  if (!reason || !reason.trim()) return
  const validationMessage = validateReasonInput(reason, t('resources.field_report_reason'))
  if (validationMessage) {
    toast.add({ title: t('common.error'), description: validationMessage, color: 'error' })
    return
  }
  try {
    await $fetch(`/api/resources/${id.value}/reviews/${reviewId}/report`, {
      method: 'POST',
      body: { reason: reason.trim() }
    })
    toast.add({ title: t('common.success'), description: t('resources.review_reported'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: getReviewMutationErrorMessage(error, t('resources.review_report_failed')), color: 'error' })
  }
}

async function submitReviewReply(reviewId: number) {
  const message = String(reviewReplyForms[reviewId] ?? '').trim()
  if (!message) {
    toast.add({ title: t('common.error'), description: t('validation.required_label', { label: t('resources.field_reply_content') }), color: 'error' })
    return
  }
  if (message.length > 5000) {
    toast.add({ title: t('common.error'), description: t('validation.max_length_label', { label: t('resources.field_reply_content'), max: 5000 }), color: 'error' })
    return
  }
  try {
    await $fetch(`/api/resources/${id.value}/reviews/${reviewId}/reply`, {
      method: 'POST',
      body: { message }
    })
    reviewReplyForms[reviewId] = ''
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.review_reply_saved'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: getReviewMutationErrorMessage(error, t('resources.review_reply_save_failed')), color: 'error' })
  }
}

async function deleteReviewReply(reviewId: number) {
  try {
    await $fetch(`/api/resources/${id.value}/reviews/${reviewId}/reply.delete`, { method: 'POST' })
    await refreshNuxtData(`resource-${route.params.category}-${id.value}`)
    toast.add({ title: t('common.success'), description: t('resources.review_reply_deleted'), color: 'success' })
  } catch {
    toast.add({ title: t('common.error'), description: t('resources.review_reply_delete_failed'), color: 'error' })
  }
}

function pushToResourcesWithTag(tag: string) {
  const q = route.query as Record<string, unknown>
  const next: Record<string, string> = {}
  const keepKeys = ['edition', 'kind', 'category', 'keyword', 'sort']
  for (const k of keepKeys) {
    const v = q[k]
    if (typeof v === 'string' && v) next[k] = v
  }
  next.tag = tag
  void router.push({ path: '/resources', query: next })
}

watch(
  () => resource.value?.isFollowed,
  (v) => {
    isFollowed.value = Boolean(v)
  },
  { immediate: true }
)

watch(
  () => resource.value?.followers,
  (v) => {
    followersCount.value = Number(v ?? 0)
  },
  { immediate: true }
)

async function toggleFollow() {
  if (!auth.isLoggedIn.value) {
    toast.add({ title: t('common.error'), description: t('resources.follow_login_required'), color: 'error' })
    return
  }
  const next = !isFollowed.value
  try {
    await $fetch(`/api/resources/${id.value}/${next ? 'follow' : 'unfollow'}`, { method: 'POST' })
    isFollowed.value = next
    followersCount.value += next ? 1 : -1
    if (followersCount.value < 0) followersCount.value = 0
    toast.add({ title: t('common.success'), description: next ? t('resources.followed') : t('resources.unfollowed'), color: 'success' })
  } catch {
    toast.add({ title: t('common.error'), description: t('resources.follow_action_failed'), color: 'error' })
  }
}

const availableGameVersions = computed(() => {
  const s = new Set<string>()
  resource.value?.versions.forEach(v => v.gameVersions?.forEach(g => s.add(g)))
  return Array.from(s).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
})

const availableLoaders = computed(() => {
  const s = new Set<string>()
  resource.value?.versions.forEach(v => v.loaders?.forEach(l => s.add(l)))
  return Array.from(s)
})

const availableServers = computed(() => {
  const s = new Set<string>()
  resource.value?.versions.forEach(v => v.serverTypes?.forEach(t => s.add(t)))
  return Array.from(s)
})

const filteredVersions = computed(() => {
  let list = [...(resource.value?.versions || [])]

  if (versionType.value !== 'all') list = list.filter(v => v.type === versionType.value)
  if (filterGameVersion.value) list = list.filter(v => v.gameVersions?.includes(filterGameVersion.value))
  if (isJavaMod.value && filterLoader.value) list = list.filter(v => v.loaders?.includes(filterLoader.value))
  if (isJavaPlugin.value && filterServerType.value) list = list.filter(v => v.serverTypes?.includes(filterServerType.value))

  return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})

const changelogGroups = computed(() => {
  const groups: {
    key: string
    version: string
    type: 'release' | 'snapshot'
    date: string
    items: typeof resource.value.changelogs
  }[] = []

  const byVersionId = new Map<number, { key: string, version: string, type: 'release' | 'snapshot', date: string, items: typeof resource.value.changelogs }>()

  for (const log of resource.value.changelogs) {
    const vid = log.resourceVersionId
    if (typeof vid === 'number' && Number.isFinite(vid)) {
      const existing = byVersionId.get(vid)
      if (existing) {
        existing.items.push(log)
        if (new Date(log.date).getTime() > new Date(existing.date).getTime()) existing.date = log.date
        continue
      }
      const group = {
        key: `v-${vid}`,
        version: log.version || log.title || String(vid),
        type: log.type,
        date: log.date,
        items: [log]
      }
      byVersionId.set(vid, group)
      groups.push(group)
      continue
    }

    groups.push({
      key: `u-${log.id ?? `${log.version}-${log.date}`}`,
      version: log.version || log.title || '',
      type: log.type,
      date: log.date,
      items: [log]
    })
  }

  return groups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})

const isAllFieldsSelected = computed(() => {
  if (!quickGameVersion.value) return false
  if (isJavaMod.value && !quickLoader.value) return false
  if (isJavaPlugin.value && !quickServerType.value) return false
  return true
})

const quickTargetVersion = computed<ResourceVersion | null>(() => {
  if (!resource.value) return null
  if (!isAllFieldsSelected.value) return null

  let list = resource.value.versions.filter(v => v.gameVersions?.includes(quickGameVersion.value))
  if (isJavaMod.value) list = list.filter(v => v.loaders?.includes(quickLoader.value))
  if (isJavaPlugin.value) list = list.filter(v => v.serverTypes?.includes(quickServerType.value))
  if (list.length === 0) return null
  // Prefer versions that already have uploaded files, then newest.
  return list.sort((a, b) => {
    const byFiles = (b.files?.length ?? 0) - (a.files?.length ?? 0)
    if (byFiles !== 0) return byFiles
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })[0]!
})

const bestDownloadVersion = computed<ResourceVersion | null>(() => {
  if (!resource.value) return null
  const list = [...(resource.value.versions || [])]
    .filter(v => (v.files?.length ?? 0) > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return list[0] ?? null
})

const downloadModalVersion = computed<ResourceVersion | null>(() => quickTargetVersion.value || bestDownloadVersion.value)

const recentDownloadableVersions = computed<ResourceVersion[]>(() => {
  if (!resource.value) return []
  const list = [...(resource.value.versions || [])]
    .filter(v => (v.files?.length ?? 0) > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return list.slice(0, 5)
})

const hasAnyDownloadableFile = computed(() => recentDownloadableVersions.value.length > 0)

const handleDownloadClick = () => {
  if (!isDownloadableResource.value) return
  downloadModalOpen.value = true
}

const clickingPrimary = ref(false)

const handleExternalClick = async () => {
  if (!isExternalResource.value) return
  if (!resource.value?.id) return
  clickingPrimary.value = true
  try {
    const res = await $fetch<{ success: boolean, url: string | null }>(`/api/resources/${resource.value.id}/click`, {
      method: 'POST',
      body: { type: 'external' }
    })
    downloadsCount.value = (downloadsCount.value || 0) + 1
    if (res?.url) {
      await navigateTo(res.url, { external: true, open: { target: '_blank' } })
    }
  } catch {
    toast.add({ title: t('common.error'), description: t('resources.open_link_failed'), color: 'error' })
  } finally {
    clickingPrimary.value = false
  }
}

const handlePurchaseClick = async () => {
  if (!isExternalPurchaseResource.value) return
  if (!resource.value?.id) return
  clickingPrimary.value = true
  try {
    const res = await $fetch<{ success: boolean, url: string | null }>(`/api/resources/${resource.value.id}/click`, {
      method: 'POST',
      body: { type: 'external_purchase' }
    })
    downloadsCount.value = (downloadsCount.value || 0) + 1
    if (res?.url) {
      await navigateTo(res.url, { external: true, open: { target: '_blank' } })
    }
  } catch {
    toast.add({ title: t('common.error'), description: t('resources.buy_now_failed'), color: 'error' })
  } finally {
    clickingPrimary.value = false
  }
}

const downloadingVersionId = ref<number | null>(null)

const downloadFile = async (v: ResourceVersion) => {
  if (!isDownloadableResource.value) return
  if (!resource.value?.id) return
  downloadingVersionId.value = v.id
  try {
    const res = await $fetch<{ success: boolean, url: string | null }>(`/api/resources/${resource.value.id}/versions/${v.id}/download`, { method: 'POST' })
    toast.add({ title: t('resources.download_toast_title'), description: `${v.name}`, color: 'primary' })
    downloadsCount.value = (downloadsCount.value || 0) + 1
    if (res?.url) {
      await navigateTo(res.url, { external: true })
    }
  } catch {
    toast.add({ title: t('common.error'), description: t('resources.download_failed'), color: 'error' })
  } finally {
    downloadingVersionId.value = null
    downloadModalOpen.value = false
  }
}

const handleFilelessClick = async () => {
  if (!isFilelessResource.value) return
  if (!resource.value?.id) return
  clickingPrimary.value = true
  try {
    await $fetch(`/api/resources/${resource.value.id}/click`, { method: 'POST', body: { type: 'fileless' } })
    downloadsCount.value = (downloadsCount.value || 0) + 1
    toast.add({ title: t('resources.fileless_title'), description: t('resources.fileless_desc'), color: 'neutral' })
  } catch {
    toast.add({ title: t('common.error'), description: t('resources.fileless_failed'), color: 'error' })
  } finally {
    clickingPrimary.value = false
  }
}

const copyHash = async (hash: string) => {
  try {
    await navigator.clipboard.writeText(hash)
    toast.add({ title: t('common.hash_copied'), color: 'success' })
  } catch {
    toast.add({
      title: t('common.copy_failed'),
      description: t('common.copy_failed_clipboard'),
      color: 'error'
    })
  }
}

const scrollToDownloads = () => {
  activeTab.value = 'versions'
  nextTick(() => {
    document.getElementById('downloads-section')?.scrollIntoView({ behavior: 'smooth' })
  })
}

useSeoMeta({
  title: () =>
    resource.value?.title
      ? t('resources.detail_page_title', { title: resource.value.title })
      : t('common.site_name'),
  description: () => resource.value?.description || ''
})

const openManagePage = () => {
  closeAllDetailModals()
  void navigateTo(`/resources/manage/${id.value}`)
}
const leaveManagePage = () => {
  closeAllDetailModals()
  void navigateTo(detailPath.value)
}
</script>

<template>
  <UContainer class="py-6">
    <div class="flex items-center gap-2 text-sm text-muted mb-4">
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        @click="router.back()"
      >
        {{ t('resources.back') }}
      </UButton>
      <span>/</span>
      <NuxtLink
        to="/resources"
        class="hover:underline"
      >
        {{ t('resources.breadcrumb_resources') }}
      </NuxtLink>
      <span>/</span>
      <span class="text-(--ui-text)">{{ resource!.categoryLabel }}</span>
    </div>

    <UCard class="overflow-hidden">
      <div class="relative">
        <div
          class="absolute inset-0 bg-cover bg-center blur-sm scale-110 opacity-40"
          :style="{ backgroundImage: `url(${resource!.cover})` }"
        />
        <div class="relative p-6 md:p-8">
          <div class="flex flex-col md:flex-row md:items-end gap-6">
            <div class="w-24 h-24 rounded-2xl overflow-hidden border border-(--ui-border) bg-(--ui-bg-elevated) shrink-0">
              <img
                :src="resource!.icon"
                :alt="resource!.title"
                class="w-full h-full object-cover"
              >
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap gap-2 mb-2">
                <UBadge
                  color="primary"
                  variant="subtle"
                >
                  {{ resource!.categoryLabel }}
                </UBadge>
                <UBadge
                  color="success"
                  variant="subtle"
                >
                  {{ taxonomyEditionLabel(resource!.taxonomy.edition) }}
                </UBadge>
                <UBadge
                  color="warning"
                  variant="subtle"
                >
                  {{ taxonomyKindLabel(resource!.taxonomy.edition, resource!.taxonomy.kind) }}
                </UBadge>
                <UBadge
                  color="neutral"
                  variant="subtle"
                >
                  {{ taxonomyEnvLabel(resource!.taxonomy.environment) }}
                </UBadge>
              </div>
              <div
                v-if="resource!.resourceFacets.length"
                class="flex flex-wrap gap-2 mb-2"
              >
                <template
                  v-for="g in resource!.resourceFacets"
                  :key="g.facetKey"
                >
                  <UBadge
                    v-for="it in g.items"
                    :key="`${g.facetKey}-${it.slug}`"
                    color="neutral"
                    variant="outline"
                  >
                    {{ g.facetName }} · {{ it.label }}
                  </UBadge>
                </template>
              </div>
              <h1 class="text-2xl md:text-3xl font-black tracking-tight truncate">
                {{ resource!.title }}
              </h1>
              <div class="mt-2 flex items-center gap-2 text-sm text-muted">
                <UAvatar
                  :src="resource!.authorAvatar"
                  size="2xs"
                />
                <span class="font-semibold text-(--ui-text)">{{ resource!.author }}</span>
                <span class="opacity-50">·</span>
                <span>{{ t('resources.last_updated', { time: formatTime(resource!.updateDate) }) }}</span>
              </div>
              <p class="mt-3 text-sm text-muted line-clamp-2">
                {{ resource!.description }}
              </p>
            </div>

            <div class="w-full md:w-72">
              <div class="flex flex-col gap-2">
                <UButton
                  v-if="isDownloadableResource"
                  color="primary"
                  size="lg"
                  icon="i-lucide-download"
                  @click="handleDownloadClick"
                >
                  {{ t('resources.download_now') }}
                </UButton>
                <UButton
                  v-if="isExternalResource && resource!.externalUrl"
                  color="primary"
                  size="lg"
                  icon="i-lucide-external-link"
                  :loading="clickingPrimary"
                  @click="handleExternalClick"
                >
                  {{ t('resources.open_link') }}
                </UButton>
                <UButton
                  v-if="isExternalPurchaseResource && resource!.externalPurchaseUrl"
                  color="primary"
                  size="lg"
                  icon="i-lucide-credit-card"
                  :loading="clickingPrimary"
                  @click="handlePurchaseClick"
                >
                  {{ t('resources.buy_now') }}
                </UButton>
                <UButton
                  v-if="isFilelessResource"
                  color="primary"
                  size="lg"
                  icon="i-lucide-info"
                  :loading="clickingPrimary"
                  @click="handleFilelessClick"
                >
                  {{ t('resources.fileless_action') }}
                </UButton>
                <UButton
                  v-if="canManageResource && !isManageMode"
                  color="neutral"
                  variant="outline"
                  size="lg"
                  icon="i-lucide-settings"
                  @click="openManagePage"
                >
                  {{ t('resources.edit_basic') }}
                </UButton>
                <UButton
                  v-if="showManageUi"
                  color="neutral"
                  variant="outline"
                  size="lg"
                  icon="i-lucide-pencil"
                  @click="openBasicEditModal"
                >
                  {{ t('resources.edit_basic') }}
                </UButton>
                <UButton
                  color="neutral"
                  variant="outline"
                  size="lg"
                  :icon="isFollowed ? 'i-lucide-heart' : 'i-lucide-heart'"
                  @click="toggleFollow"
                >
                  {{ isFollowed ? t('resources.following') : t('resources.follow') }}
                </UButton>
                <UButton
                  v-if="showManageUi && !isResourceDeleted && isResourceVisible"
                  color="warning"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-eye-off"
                  @click="openResourceStateConfirm('hide')"
                >
                  {{ t('resources.hide_resource') }}
                </UButton>
                <UButton
                  v-if="showManageUi && !isResourceVisible"
                  color="success"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-eye"
                  @click="openResourceStateConfirm('restore')"
                >
                  {{ t('resources.restore_resource') }}
                </UButton>
                <UButton
                  v-if="showManageUi && !isResourceDeleted"
                  color="error"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-trash-2"
                  @click="openResourceStateConfirm('delete')"
                >
                  {{ t('resources.delete_resource') }}
                </UButton>
                <UButton
                  v-if="showManageUi"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-arrow-left"
                  @click="leaveManagePage"
                >
                  {{ t('resources.back') }}
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <div class="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-9">
        <UTabs
          v-model="activeTab"
          :items="tabItems"
        >
            <template #content="{ item }">
              <div
                v-if="item.value === 'description'"
                class="prose dark:prose-invert max-w-none"
              >
                <div
                  v-if="showManageUi"
                  class="not-prose mb-3 flex justify-end"
                >
                  <UButton
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-pencil"
                    @click="openEditDescriptionModal"
                  >
                    {{ t('resources.edit_description') }}
                  </UButton>
                </div>
                <div v-html="resource!.descriptionHtml" />
              </div>

              <div v-else-if="item.value === 'gallery'">
                <UCard
                  v-if="showManageUi"
                  class="mb-4"
                >
                  <div class="font-semibold mb-3">
                    {{ t('resources.media_manage') }}
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <UFormField :label="t('resources.media_cover_url')">
                      <UInput v-model="mediaCoverInput" />
                    </UFormField>
                    <UFormField :label="t('resources.media_icon_url')">
                      <UInput v-model="mediaIconInput" />
                    </UFormField>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <UFormField :label="t('resources.media_cover_upload')">
                      <input
                        ref="coverUploadInput"
                        type="file"
                        accept="image/*"
                        class="block w-full text-sm"
                      >
                      <div class="mt-1 text-xs text-muted">
                        {{ t('resources.media_cover_requirements') }}
                      </div>
                    </UFormField>
                    <UFormField :label="t('resources.media_icon_upload')">
                      <input
                        ref="iconUploadInput"
                        type="file"
                        accept="image/*"
                        class="block w-full text-sm"
                      >
                      <div class="mt-1 text-xs text-muted">
                        {{ t('resources.media_icon_requirements') }}
                      </div>
                    </UFormField>
                  </div>
                  <div class="mt-3 flex justify-end gap-2">
                    <UButton
                      color="neutral"
                      variant="outline"
                      :loading="mediaSubmitting"
                      @click="uploadIcon"
                    >
                      {{ t('resources.upload_icon') }}
                    </UButton>
                    <UButton
                      color="neutral"
                      variant="outline"
                      :loading="mediaSubmitting"
                      @click="uploadCover"
                    >
                      {{ t('resources.upload_cover') }}
                    </UButton>
                    <UButton
                      color="neutral"
                      variant="outline"
                      :loading="mediaSubmitting"
                      @click="saveIcon"
                    >
                      {{ t('resources.save_icon') }}
                    </UButton>
                    <UButton
                      color="primary"
                      :loading="mediaSubmitting"
                      @click="saveCover"
                    >
                      {{ t('resources.save_cover') }}
                    </UButton>
                  </div>

                  <div class="mt-6 font-semibold">
                    {{ t('resources.gallery_manage') }}
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3 items-end">
                    <div class="md:col-span-7">
                      <UFormField :label="t('resources.gallery_upload')">
                        <input
                          ref="galleryUploadInput"
                          type="file"
                          accept="image/*"
                          class="block w-full text-sm"
                        >
                        <div class="mt-1 text-xs text-muted">
                          {{ t('resources.media_gallery_requirements') }}
                        </div>
                      </UFormField>
                    </div>
                    <div class="md:col-span-4">
                      <UFormField :label="t('resources.gallery_caption')">
                        <UInput v-model="galleryUploadCaption" />
                      </UFormField>
                    </div>
                    <div class="md:col-span-1 flex justify-end">
                      <UButton
                        color="primary"
                        :loading="mediaSubmitting"
                        @click="uploadGallery"
                      >
                        {{ t('resources.upload_gallery') }}
                      </UButton>
                    </div>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3 items-end">
                    <div class="md:col-span-7">
                      <UFormField :label="t('resources.gallery_image_url')">
                        <UInput v-model="galleryNewUrl" />
                      </UFormField>
                    </div>
                    <div class="md:col-span-4">
                      <UFormField :label="t('resources.gallery_caption')">
                        <UInput v-model="galleryNewCaption" />
                      </UFormField>
                    </div>
                    <div class="md:col-span-1 flex justify-end">
                      <UButton
                        color="primary"
                        :loading="mediaSubmitting"
                        @click="addGalleryItem"
                      >
                        {{ t('common.add') }}
                      </UButton>
                    </div>
                  </div>

                  <div
                    v-if="galleryEditing.length > 0"
                    class="mt-4 space-y-2"
                  >
                    <div
                      v-for="(g, idx) in galleryEditing"
                      :key="idx"
                      class="grid grid-cols-1 md:grid-cols-12 gap-2 items-end"
                    >
                      <div class="md:col-span-7">
                        <UFormField :label="t('resources.gallery_image_url')">
                          <UInput v-model="g.url" />
                        </UFormField>
                      </div>
                      <div class="md:col-span-4">
                        <UFormField :label="t('resources.gallery_caption')">
                          <UInput v-model="g.caption" />
                        </UFormField>
                      </div>
                      <div class="md:col-span-1 flex justify-end">
                        <UButton
                          color="error"
                          variant="outline"
                          :disabled="mediaSubmitting"
                          @click="galleryEditing = galleryEditing.filter((_, i) => i !== idx)"
                        >
                          {{ t('common.delete') }}
                        </UButton>
                      </div>
                    </div>
                    <div class="flex justify-end">
                      <UButton
                        color="primary"
                        :loading="mediaSubmitting"
                        @click="saveGalleryBulk"
                      >
                        {{ t('resources.save_gallery') }}
                      </UButton>
                    </div>
                  </div>
                </UCard>

                <UEmpty
                  v-if="resource!.gallery.length === 0"
                  icon="i-lucide-image-off"
                  :title="t('resources.gallery_empty_title')"
                  :description="t('resources.gallery_empty_desc')"
                  class="py-8"
                />

                <div
                  v-else
                  class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  <UCard
                    v-for="(img, idx) in resource!.gallery"
                    :key="idx"
                    class="overflow-hidden"
                  >
                    <div class="aspect-[16/10] rounded-md overflow-hidden bg-(--ui-bg-elevated) border border-(--ui-border)">
                      <img
                        :src="img.url"
                        :alt="img.caption"
                        class="w-full h-full object-cover"
                      >
                    </div>
                    <div class="mt-2 text-sm text-muted">
                      {{ img.caption }}
                    </div>
                  </UCard>
                </div>
              </div>

              <div v-else-if="item.value === 'versions'">
                <div
                  id="downloads-section"
                  class="flex flex-col gap-4"
                >
                  <UCard v-if="showManageUi">
                    <div class="font-semibold mb-3">
                      {{ t('resources.publish_version') }}
                    </div>
                    <div class="flex flex-col md:flex-row md:items-end gap-2 mb-3">
                      <div class="flex-1">
                        <div class="text-xs text-muted mb-1">
                          {{ t('resources.version_file_pick') }}
                        </div>
                        <input
                          ref="uploadFileInput"
                          type="file"
                          class="block w-full text-sm"
                          @change="onPickedVersionFile"
                        >
                      </div>
                      <UButton
                        color="primary"
                        :loading="uploadingFile && uploadVersionId === (resource!.versions[0]?.id ?? 0)"
                        @click="resource!.versions[0]?.id && pickFileForVersion(resource!.versions[0].id)"
                      >
                        {{ t('resources.upload_to_latest') }}
                      </UButton>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <UFormField :label="t('resources.publish.version_name')">
                        <UInput v-model="versionForm.name" />
                      </UFormField>
                      <UFormField :label="t('resources.publish.version_type')">
                        <USelect
                          v-model="versionForm.type"
                          :items="[
                            { label: t('resources.version_type_release'), value: 'release' },
                            { label: t('resources.version_type_snapshot'), value: 'snapshot' }
                          ]"
                          label-key="label"
                          value-key="value"
                        />
                      </UFormField>
                      <UFormField :label="t('resources.publish.size')">
                        <UInput v-model="versionForm.size" />
                      </UFormField>
                      <UFormField :label="t('resources.publish.game_versions')">
                        <UInput v-model="versionForm.gameVersionsRaw" />
                      </UFormField>
                      <UFormField :label="t('resources.publish.loaders')">
                        <UInput v-model="versionForm.loadersRaw" />
                      </UFormField>
                      <UFormField :label="t('resources.publish.server_types')">
                        <UInput v-model="versionForm.serverTypesRaw" />
                      </UFormField>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <UFormField :label="t('resources.update_title')">
                        <UInput v-model="versionForm.updateTitle" />
                      </UFormField>
                      <UFormField :label="t('resources.update_type')">
                        <USelect
                          v-model="versionForm.updateType"
                          :items="[
                            { label: t('resources.update_type_update'), value: 'update' },
                            { label: t('resources.version_type_release'), value: 'release' },
                            { label: t('resources.version_type_snapshot'), value: 'snapshot' }
                          ]"
                          label-key="label"
                          value-key="value"
                        />
                      </UFormField>
                    </div>
                    <UFormField
                      class="mt-3"
                      :label="t('resources.update_message')"
                    >
                      <UTextarea
                        v-model="versionForm.updateMessage"
                        :rows="6"
                      />
                    </UFormField>
                    <div class="mt-3 flex justify-end">
                      <UButton
                        color="primary"
                        :loading="submittingVersion"
                        @click="submitVersion"
                      >
                        {{ t('resources.publish_action') }}
                      </UButton>
                    </div>
                  </UCard>

                  <UCard :ui="{ body: 'p-4' }">
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div class="md:col-span-4">
                        <div class="text-xs text-muted mb-1">
                          {{ t('resources.filter_game_version') }}
                        </div>
                        <USelect
                          v-model="filterGameVersion"
                          :items="availableGameVersions"
                          :placeholder="t('resources.placeholder_supported_game_versions')"
                        />
                      </div>

                      <div
                        v-if="isJavaMod"
                        class="md:col-span-4"
                      >
                        <div class="text-xs text-muted mb-1">
                          {{ t('resources.filter_mod_loader') }}
                        </div>
                        <USelect
                          v-model="filterLoader"
                          :items="availableLoaders"
                          :placeholder="t('resources.placeholder_loader')"
                        />
                      </div>

                      <div
                        v-if="isJavaPlugin"
                        class="md:col-span-4"
                      >
                        <div class="text-xs text-muted mb-1">
                          {{ t('resources.filter_server_type') }}
                        </div>
                        <USelect
                          v-model="filterServerType"
                          :items="availableServers"
                          :placeholder="t('resources.placeholder_server')"
                        />
                      </div>

                      <div class="md:col-span-12">
                        <div class="text-xs text-muted mb-1">
                          {{ t('resources.filter_version_type') }}
                        </div>
                        <URadioGroup
                          v-model="versionType"
                          orientation="horizontal"
                          :items="versionTypeItems"
                        />
                      </div>
                    </div>
                  </UCard>

                  <UEmpty
                    v-if="filteredVersions.length === 0"
                    :title="t('resources.versions_filtered_empty_title')"
                    :description="t('resources.versions_filtered_empty_desc')"
                  />

                  <div
                    v-else
                    class="flex flex-col gap-2"
                  >
                    <input
                      ref="replaceFileInput"
                      type="file"
                      class="hidden"
                      @change="onPickedReplaceFile"
                    >
                    <UCard
                      v-for="v in filteredVersions"
                      :id="`version-${v.id}`"
                      :key="v.id"
                    >
                      <div class="flex flex-col md:flex-row md:items-center gap-4">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <div class="font-semibold truncate">
                              {{ v.name }}
                            </div>
                            <UBadge
                              :color="v.type === 'release' ? 'success' : 'warning'"
                              variant="subtle"
                            >
                              {{ versionTypeLabel(v.type) }}
                            </UBadge>
                          </div>
                          <div class="mt-1 text-xs text-muted flex flex-wrap gap-2">
                            <span class="inline-flex items-center gap-1">
                              <UIcon name="i-lucide-calendar" />
                              {{ formatTime(v.date) }}
                            </span>
                            <span class="inline-flex items-center gap-1">
                              <UIcon name="i-lucide-download" />
                              {{ v.downloads }}
                            </span>
                            <span class="inline-flex items-center gap-1">
                              <UIcon name="i-lucide-hard-drive" />
                              {{ v.size }}
                            </span>
                          </div>
                          <div class="mt-2 flex flex-wrap gap-2">
                            <UBadge
                              v-for="gv in v.gameVersions"
                              :key="gv"
                              color="neutral"
                              variant="subtle"
                            >
                              {{ gv }}
                            </UBadge>
                            <UBadge
                              v-for="l in (v.loaders || [])"
                              :key="l"
                              color="primary"
                              variant="subtle"
                            >
                              {{ l }}
                            </UBadge>
                            <UBadge
                              v-for="s in (v.serverTypes || [])"
                              :key="s"
                              color="primary"
                              variant="subtle"
                            >
                              {{ s }}
                            </UBadge>
                            <template
                              v-for="g in v.facets"
                              :key="`${v.id}-${g.facetKey}`"
                            >
                              <UBadge
                                v-for="it in g.items"
                                :key="`${v.id}-${g.facetKey}-${it.slug}`"
                                color="neutral"
                                variant="outline"
                              >
                                {{ g.facetName }}: {{ it.label }}
                              </UBadge>
                            </template>
                          </div>
                        </div>

                        <div class="flex items-center gap-2">
                          <UButton
                            color="neutral"
                            variant="outline"
                            icon="i-lucide-link"
                            :to="`/versions/${v.id}`"
                          >
                            {{ t('resources.open_version_permalink') }}
                          </UButton>
                          <UButton
                            v-if="showManageUi"
                            color="neutral"
                            variant="outline"
                            :loading="uploadingFile && uploadVersionId === v.id"
                            @click="pickFileForVersion(v.id)"
                          >
                            {{ t('resources.upload_file') }}
                          </UButton>
                          <UButton
                            color="neutral"
                            variant="outline"
                            icon="i-lucide-copy"
                            :disabled="!v.hash"
                            @click="v.hash && copyHash(v.hash)"
                          >
                            {{ t('resources.copy_hash') }}
                          </UButton>
                          <UButton
                            color="primary"
                            icon="i-lucide-download"
                            :loading="downloadingVersionId === v.id"
                            @click="downloadFile(v)"
                          >
                            {{ t('resources.download') }}
                          </UButton>
                          <UButton
                            v-if="!showManageUi && auth.isLoggedIn.value"
                            color="warning"
                            variant="outline"
                            icon="i-lucide-flag"
                            @click="reportVersion(v.id)"
                          >
                            {{ t('resources.version_report') }}
                          </UButton>
                        </div>
                      </div>

                      <div
                        v-if="(v.files || []).length"
                        class="mt-4 space-y-2"
                      >
                        <div class="text-xs text-muted">
                          {{ t('resources.version_files') }}
                        </div>
                        <div
                          v-if="showManageUi"
                          class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-(--ui-border) px-3 py-2"
                        >
                          <div class="flex items-center gap-3 text-xs text-muted">
                            <label class="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                :checked="selectedFilesCount(v.id) > 0 && selectedFilesCount(v.id) === getVersionFiles(v).length"
                                @change="toggleAllVersionFiles(v, (($event.target as HTMLInputElement)?.checked))"
                              >
                              <span>{{ t('resources.select_all') }}</span>
                            </label>
                            <span>{{ t('resources.file_selected_count', { count: selectedFilesCount(v.id) }) }}</span>
                            <span>{{ t('resources.file_drag_hint') }}</span>
                          </div>
                          <div class="flex items-center gap-2">
                            <UButton
                              size="xs"
                              color="neutral"
                              variant="outline"
                              :disabled="uploadingFile || !(draftFileOrderByVersion[v.id]?.length)"
                              @click="saveVersionFileOrder(v)"
                            >
                              {{ t('resources.save_order') }}
                            </UButton>
                            <UButton
                              size="xs"
                              color="neutral"
                              variant="ghost"
                              :disabled="uploadingFile || !(draftFileOrderByVersion[v.id]?.length)"
                              @click="clearDraftOrder(v.id)"
                            >
                              {{ t('common.cancel') }}
                            </UButton>
                            <UButton
                              size="xs"
                              color="error"
                              variant="outline"
                              :loading="bulkDeletingVersionId === v.id"
                              :disabled="uploadingFile || selectedFilesCount(v.id) === 0"
                              @click="bulkDeleteVersionFiles(v.id)"
                            >
                              {{ t('resources.delete_selected') }}
                            </UButton>
                          </div>
                        </div>
                        <div class="flex flex-col gap-2">
                          <div
                            v-for="(f, _fileIdx) in getVersionFiles(v)"
                            :key="f.id"
                            class="flex items-center justify-between gap-2 border border-(--ui-border) rounded-md px-3 py-2"
                            :class="showManageUi ? 'cursor-move' : ''"
                            :draggable="showManageUi"
                            @dragstart="onVersionFileDragStart(v.id, f.id)"
                            @dragover="onVersionFileDragOver"
                            @drop="onVersionFileDrop(v, f.id)"
                          >
                            <div class="min-w-0 flex items-center gap-2">
                              <input
                                v-if="showManageUi"
                                type="checkbox"
                                :checked="isVersionFileSelected(v.id, f.id)"
                                @change="toggleVersionFileSelected(v.id, f.id, (($event.target as HTMLInputElement)?.checked))"
                              >
                              <div class="flex items-center gap-2 min-w-0">
                                <div class="text-sm font-medium truncate">
                                  {{ f.displayName || f.fileName }}
                                </div>
                                <UBadge
                                  v-if="f.isPrimary"
                                  color="primary"
                                  variant="subtle"
                                  size="xs"
                                >
                                  {{ t('resources.file_primary') }}
                                </UBadge>
                              </div>
                              <div class="text-xs text-muted">
                                {{ formatBytes(f.sizeBytes) }}
                              </div>
                            </div>
                            <div class="flex items-center gap-2">
                              <UButton
                                size="xs"
                                color="neutral"
                                variant="outline"
                                :loading="isFileActionLoading(v.id, f.id)"
                                :disabled="uploadingFile || isFileActionLoading(v.id, f.id)"
                                @click="downloadVersionFile(v.id, f.id)"
                              >
                                {{ t('resources.download_file') }}
                              </UButton>
                              <UButton
                                v-if="showManageUi && !f.isPrimary"
                                size="xs"
                                color="neutral"
                                variant="outline"
                                :loading="isFileActionLoading(v.id, f.id)"
                                :disabled="uploadingFile || isFileActionLoading(v.id, f.id)"
                                @click="setPrimaryVersionFile(v.id, f.id)"
                              >
                                {{ t('resources.set_primary') }}
                              </UButton>
                              <UButton
                                v-if="showManageUi"
                                size="xs"
                                color="neutral"
                                variant="outline"
                                :loading="isFileActionLoading(v.id, f.id)"
                                :disabled="uploadingFile || isFileActionLoading(v.id, f.id)"
                                @click="renameVersionFile(v.id, f.id, f.displayName || f.fileName)"
                              >
                                {{ t('resources.rename_file') }}
                              </UButton>
                              <UButton
                                v-if="showManageUi"
                                size="xs"
                                color="neutral"
                                variant="outline"
                                :disabled="uploadingFile || isFileActionLoading(v.id, f.id) || !canMoveVersionFile(v, f.id, 'up')"
                                @click="moveVersionFile(v, f.id, 'up')"
                              >
                                {{ t('resources.move_up') }}
                              </UButton>
                              <UButton
                                v-if="showManageUi"
                                size="xs"
                                color="neutral"
                                variant="outline"
                                :disabled="uploadingFile || isFileActionLoading(v.id, f.id) || !canMoveVersionFile(v, f.id, 'down')"
                                @click="moveVersionFile(v, f.id, 'down')"
                              >
                                {{ t('resources.move_down') }}
                              </UButton>
                              <UButton
                                v-if="showManageUi"
                                size="xs"
                                color="neutral"
                                variant="outline"
                                :loading="isFileActionLoading(v.id, f.id)"
                                :disabled="uploadingFile || isFileActionLoading(v.id, f.id)"
                                @click="pickReplaceFile(v.id, f.id)"
                              >
                                {{ t('resources.replace_file') }}
                              </UButton>
                              <UButton
                                v-if="showManageUi"
                                size="xs"
                                color="error"
                                variant="outline"
                                :loading="isFileActionLoading(v.id, f.id)"
                                :disabled="uploadingFile || isFileActionLoading(v.id, f.id)"
                                @click="deleteVersionFile(v.id, f.id)"
                              >
                                {{ t('common.delete') }}
                              </UButton>
                            </div>
                          </div>
                        </div>
                      </div>
                    </UCard>
                  </div>
                </div>
              </div>

              <div v-else-if="item.value === 'changelog'">
                <UCard
                  v-if="showManageUi"
                  class="mb-4"
                >
                  <div class="font-semibold mb-3">
                    {{ t('resources.publish_update') }}
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <UFormField :label="t('resources.update_title')">
                      <UInput v-model="updateForm.title" />
                    </UFormField>
                    <UFormField :label="t('resources.update_version')">
                      <UInput
                        v-model="updateForm.versionString"
                        :placeholder="resource!.latestVersion"
                      />
                    </UFormField>
                    <UFormField :label="t('resources.update_type')">
                      <USelect
                        v-model="updateForm.updateType"
                        :items="[
                          { label: t('resources.update_type_update'), value: 'update' },
                          { label: t('resources.version_type_release'), value: 'release' },
                          { label: t('resources.version_type_snapshot'), value: 'snapshot' }
                        ]"
                        label-key="label"
                        value-key="value"
                      />
                    </UFormField>
                    <div />
                  </div>
                  <UFormField
                    class="mt-3"
                    :label="t('resources.update_message')"
                  >
                    <UTextarea
                      v-model="updateForm.message"
                      :rows="6"
                    />
                  </UFormField>
                  <div class="mt-3 flex justify-end">
                    <UButton
                      color="primary"
                      :loading="submittingUpdate"
                      @click="submitUpdate"
                    >
                      {{ t('resources.publish_action') }}
                    </UButton>
                  </div>
                </UCard>
                <UEmpty
                  v-if="changelogGroups.length === 0"
                  icon="i-lucide-scroll-text"
                  :title="t('resources.changelog_empty_title')"
                  :description="t('resources.changelog_empty_desc')"
                />
                <div
                  v-else
                  class="flex flex-col gap-4"
                >
                  <UCard
                    v-for="group in changelogGroups"
                    :key="group.key"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <div class="font-semibold">
                        {{ group.version }}
                      </div>
                      <UBadge
                        :color="group.type === 'release' ? 'success' : 'warning'"
                        variant="subtle"
                      >
                        {{ versionTypeLabel(group.type) }}
                      </UBadge>
                    </div>
                    <div class="mt-1 text-xs text-muted">
                      {{ formatTime(group.date) }}
                    </div>
                    <div class="mt-3 flex flex-col gap-3">
                      <div
                        v-for="log in group.items"
                        :id="log.id ? `update-${log.id}` : undefined"
                        :key="log.id ?? `${log.version}-${log.date}`"
                      >
                        <div
                          v-if="log.id"
                          class="not-prose mb-2 flex justify-end gap-2"
                        >
                          <UButton
                            size="xs"
                            color="neutral"
                            variant="outline"
                            icon="i-lucide-link"
                            :to="`/updates/${log.id}`"
                          >
                            {{ t('resources.open_update_permalink') }}
                          </UButton>
                          <UButton
                            v-if="log.messageState !== 'deleted'"
                            size="xs"
                            :color="log.votedByMe ? 'primary' : 'neutral'"
                            :variant="log.votedByMe ? 'soft' : 'outline'"
                            icon="i-lucide-thumbs-up"
                            @click="voteUpdate(log.id)"
                          >
                            {{ log.voteCount ?? 0 }}
                          </UButton>
                          <UButton
                            v-if="showManageUi && log.messageState !== 'deleted'"
                            size="xs"
                            color="neutral"
                            variant="outline"
                            icon="i-lucide-pencil"
                            @click="openEditUpdate(log)"
                          >
                            {{ t('resources.edit_update') }}
                          </UButton>
                          <UButton
                            v-if="showManageUi && log.messageState !== 'deleted'"
                            size="xs"
                            color="error"
                            variant="outline"
                            icon="i-lucide-trash-2"
                            @click="openDeleteUpdate(log.id)"
                          >
                            {{ t('resources.delete_update') }}
                          </UButton>
                          <UButton
                            v-if="showManageUi && log.messageState === 'deleted'"
                            size="xs"
                            color="primary"
                            variant="outline"
                            icon="i-lucide-rotate-ccw"
                            @click="restoreUpdate(log.id)"
                          >
                            {{ t('resources.restore_update') }}
                          </UButton>
                          <UButton
                            v-if="!showManageUi && auth.isLoggedIn.value && log.messageState !== 'deleted'"
                            size="xs"
                            color="warning"
                            variant="outline"
                            icon="i-lucide-flag"
                            @click="reportUpdate(log.id)"
                          >
                            {{ t('resources.update_report') }}
                          </UButton>
                        </div>
                        <div
                          class="prose dark:prose-invert max-w-none"
                          :class="log.messageState === 'deleted' ? 'opacity-50' : ''"
                          v-html="log.markdownHtml"
                        />
                      </div>
                    </div>
                  </UCard>
                </div>
              </div>

              <div v-else-if="item.value === 'reviews'">
                <UCard
                  v-if="canSubmitReview"
                  class="mb-4"
                >
                  <div class="space-y-3">
                    <div class="text-sm font-semibold">
                      {{ hasOwnReview ? t('resources.review_update') : t('resources.review_publish') }}
                    </div>
                    <USelect
                      v-model="reviewForm.rating"
                      :items="[
                        { label: `5 ★`, value: 5 },
                        { label: `4 ★`, value: 4 },
                        { label: `3 ★`, value: 3 },
                        { label: `2 ★`, value: 2 },
                        { label: `1 ★`, value: 1 }
                      ]"
                      label-key="label"
                      value-key="value"
                    />
                    <UTextarea
                      v-model="reviewForm.content"
                      :rows="4"
                      :placeholder="t('resources.review_content_placeholder')"
                    />
                    <UButton
                      color="primary"
                      :loading="reviewSubmitting"
                      :disabled="!reviewForm.content.trim()"
                      @click="submitReview"
                    >
                      {{ t('resources.review_submit') }}
                    </UButton>
                  </div>
                </UCard>
                <UEmpty
                  v-if="resource!.reviews.length === 0"
                  icon="i-lucide-message-square-text"
                  :title="t('resources.reviews_empty_title')"
                  :description="t('resources.reviews_empty_desc')"
                />
                <div
                  v-else
                  class="flex flex-col gap-4"
                >
                  <div class="flex justify-end">
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="outline"
                      icon="i-lucide-filter"
                      :to="`/resources/${resource!.id}/reviews`"
                    >
                      {{ t('resources.review_open_filters_page') }}
                    </UButton>
                  </div>
                  <UCard
                    v-for="r in resource!.reviews"
                    :id="`review-${r.id}`"
                    :key="r.id"
                  >
                    <div class="flex items-start gap-3">
                      <UAvatar :src="r.userAvatar" />
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-2">
                          <NuxtLink
                            :to="`/resources/${resource!.id}/review/${r.id}`"
                            class="font-semibold hover:underline"
                          >
                            {{ r.userName }}
                          </NuxtLink>
                          <div class="text-xs text-muted">
                            {{ formatTime(r.time) }}
                          </div>
                        </div>
                        <div
                          class="mt-2 text-sm text-muted"
                          :class="r.reviewState === 'deleted' ? 'line-through opacity-60' : ''"
                        >
                          {{ r.content }}
                        </div>
                        <div class="mt-2">
                          <UBadge
                            color="warning"
                            variant="subtle"
                          >
                            {{ r.rating }} / 5
                          </UBadge>
                        </div>
                        <div class="mt-3 flex items-center gap-2 text-xs text-muted">
                          <UButton
                            size="xs"
                            :color="r.likedByMe ? 'primary' : 'neutral'"
                            :variant="r.likedByMe ? 'soft' : 'ghost'"
                            icon="i-lucide-thumbs-up"
                            :disabled="r.reviewState === 'deleted'"
                            @click="likeReview(r.id)"
                          >
                            {{ r.likes }}
                          </UButton>
                          <UButton
                            v-if="auth.user.value && Number(auth.user.value.id) !== Number(r.userId)"
                            size="xs"
                            color="warning"
                            variant="ghost"
                            icon="i-lucide-flag"
                            @click="reportReview(r.id)"
                          >
                            {{ t('resources.review_report') }}
                          </UButton>
                          <UButton
                            v-if="canDeleteReview(r.userId)"
                            size="xs"
                            :color="r.reviewState === 'deleted' ? 'success' : 'error'"
                            variant="ghost"
                            :icon="r.reviewState === 'deleted' ? 'i-lucide-rotate-ccw' : 'i-lucide-trash-2'"
                            @click="r.reviewState === 'deleted' ? restoreReview(r.id) : deleteReview(r.id)"
                          >
                            {{ r.reviewState === 'deleted' ? t('resources.review_restore') : t('resources.review_delete') }}
                          </UButton>
                        </div>
                        <div
                          v-if="r.reply"
                          class="mt-3 rounded-md border border-(--ui-border) bg-(--ui-bg-elevated)/60 p-3"
                        >
                          <div class="flex items-center justify-between gap-2">
                            <div class="text-xs font-medium">
                              {{ t('resources.review_reply_from', { user: r.reply.userName }) }}
                            </div>
                            <div class="text-xs text-muted">
                              {{ formatTime(r.reply.updatedAt || r.reply.createdAt) }}
                            </div>
                          </div>
                          <div class="mt-1 text-sm whitespace-pre-wrap break-words">
                            {{ r.reply.message }}
                          </div>
                          <div
                            v-if="showManageUi || auth.canAdmin.value"
                            class="mt-2 flex justify-end"
                          >
                            <UButton
                              size="xs"
                              color="error"
                              variant="ghost"
                              icon="i-lucide-x"
                              @click="deleteReviewReply(r.id)"
                            >
                              {{ t('resources.review_reply_delete') }}
                            </UButton>
                          </div>
                        </div>
                        <div
                          v-if="(showManageUi || auth.canAdmin.value)"
                          class="mt-3 space-y-2"
                        >
                          <UTextarea
                            v-model="reviewReplyForms[r.id]"
                            :rows="2"
                            :placeholder="t('resources.review_reply_placeholder')"
                          />
                          <div class="flex justify-end">
                            <UButton
                              size="xs"
                              color="primary"
                              :disabled="!String(reviewReplyForms[r.id] ?? '').trim()"
                              @click="submitReviewReply(r.id)"
                            >
                              {{ r.reply ? t('resources.review_reply_update') : t('resources.review_reply_submit') }}
                            </UButton>
                          </div>
                        </div>
                      </div>
                    </div>
                  </UCard>
                </div>
              </div>
            </template>
        </UTabs>
      </div>

      <div class="lg:col-span-3">
        <div class="flex flex-col gap-4">
          <div class="grid grid-cols-3 gap-3">
            <UCard
              class="aspect-square text-center"
              :ui="{ body: 'h-full flex flex-col items-center justify-center p-2' }"
            >
              <div class="text-lg font-bold">
                {{ downloadsCount }}
              </div>
              <div class="text-xs text-muted">
                {{ t('resources.stat_downloads') }}
              </div>
            </UCard>
            <UCard
              class="aspect-square text-center"
              :ui="{ body: 'h-full flex flex-col items-center justify-center p-2' }"
            >
              <div class="text-lg font-bold">
                {{ resource!.viewCount ?? 0 }}
              </div>
              <div class="text-xs text-muted">
                {{ t('resources.stat_views') }}
              </div>
            </UCard>
            <UCard
              class="aspect-square text-center"
              :ui="{ body: 'h-full flex flex-col items-center justify-center p-2' }"
            >
              <div class="text-lg font-bold">
                {{ followersCount }}
              </div>
              <div class="text-xs text-muted">
                {{ t('resources.stat_followers') }}
              </div>
            </UCard>
          </div>

          <UCard>
            <div class="text-sm font-semibold mb-2">
              {{ t('resources.related_links') }}
            </div>
            <div
              v-if="showManageUi"
              class="mb-3 space-y-3"
            >
              <div class="grid grid-cols-1 gap-2">
                <UFormField :label="t('resources.link_label')">
                  <UInput v-model="linkNewLabel" />
                </UFormField>
                <UFormField :label="t('resources.link_url')">
                  <UInput v-model="linkNewUrl" />
                </UFormField>
                <UFormField :label="t('resources.link_icon')">
                  <UInput v-model="linkNewIcon" />
                </UFormField>
              </div>
              <div class="flex justify-end">
                <UButton
                  color="primary"
                  size="sm"
                  :loading="linksSubmitting"
                  @click="addLinkItem"
                >
                  {{ t('common.add') }}
                </UButton>
              </div>

              <div
                v-if="linksEditing.length"
                class="space-y-2"
              >
                <div
                  v-for="(l, idx) in linksEditing"
                  :key="idx"
                  class="grid grid-cols-1 gap-2"
                >
                  <UFormField :label="t('resources.link_label')">
                    <UInput v-model="l.label" />
                  </UFormField>
                  <UFormField :label="t('resources.link_url')">
                    <UInput v-model="l.url" />
                  </UFormField>
                  <UFormField :label="t('resources.link_icon')">
                    <UInput v-model="l.icon" />
                  </UFormField>
                  <div class="flex justify-end">
                    <UButton
                      color="error"
                      variant="outline"
                      size="xs"
                      :disabled="linksSubmitting"
                      @click="linksEditing = linksEditing.filter((_, i) => i !== idx)"
                    >
                      {{ t('common.delete') }}
                    </UButton>
                  </div>
                </div>
                <div class="flex justify-end">
                  <UButton
                    color="primary"
                    size="sm"
                    :loading="linksSubmitting"
                    @click="saveLinksBulk"
                  >
                    {{ t('resources.save_links') }}
                  </UButton>
                </div>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <UButton
                v-for="l in resource!.links"
                :key="l.label"
                :to="l.url"
                target="_blank"
                color="neutral"
                variant="outline"
                :icon="l.icon"
                class="justify-start"
              >
                {{ l.label }}
              </UButton>
            </div>
          </UCard>

          <UCard>
            <div class="text-sm font-semibold mb-2">
              {{ t('resources.team_members') }}
            </div>
            <div class="flex flex-wrap gap-2 mb-3">
              <UBadge
                color="neutral"
                variant="subtle"
              >
                {{ resource!.author }}
              </UBadge>
              <UBadge
                v-for="m in (resource!.teamMembers || [])"
                :key="m.id"
                color="neutral"
                variant="outline"
              >
                {{ m.username }}
              </UBadge>
            </div>
            <div
              v-if="isManageMode && (isOwner || auth.canAdmin)"
              class="space-y-2"
            >
              <UInput
                v-model="teamMemberNamesInput"
                :placeholder="t('resources.team_members_placeholder')"
              />
              <UButton
                size="sm"
                color="primary"
                :loading="submittingTeamMembers"
                @click="saveTeamMembers"
              >
                {{ t('resources.save_team_members') }}
              </UButton>
            </div>
          </UCard>

          <UCard>
            <div class="text-sm font-semibold mb-2">
              {{ t('resources.tags') }}
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="t in resource!.tags"
                :key="t"
                size="xs"
                color="neutral"
                variant="outline"
                @click="pushToResourcesWithTag(t)"
              >
                {{ t }}
              </UButton>
            </div>
          </UCard>

          <UCard v-if="isDownloadableResource">
            <div class="text-sm font-semibold mb-2">
              {{ t('resources.quick_download') }}
            </div>
            <div class="flex flex-col gap-3">
              <USelect
                v-model="quickGameVersion"
                :items="availableGameVersions"
                :placeholder="t('resources.placeholder_pick_game_version')"
              />

              <USelect
                v-if="isJavaMod"
                v-model="quickLoader"
                :items="availableLoaders"
                :placeholder="t('resources.placeholder_pick_loader')"
              />
              <USelect
                v-if="isJavaPlugin"
                v-model="quickServerType"
                :items="availableServers"
                :placeholder="t('resources.placeholder_pick_server')"
              />

              <UCard
                v-if="quickTargetVersion"
                :ui="{ body: 'p-3' }"
              >
                <div class="text-sm font-semibold">
                  {{ quickTargetVersion.name }}
                </div>
                <div class="text-xs text-muted mt-1">
                  {{ quickTargetVersion.size }} • {{ formatTime(quickTargetVersion.date) }}
                </div>
              </UCard>

              <UButton
                color="primary"
                :disabled="!quickTargetVersion"
                icon="i-lucide-download"
                @click="quickTargetVersion && downloadFile(quickTargetVersion)"
              >
                {{ t('resources.download_this_version') }}
              </UButton>

              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-mouse-pointer-click"
                @click="scrollToDownloads"
              >
                {{ t('resources.jump_version_list') }}
              </UButton>
            </div>
          </UCard>
        </div>
      </div>
    </div>

    <UModal
      v-model:open="downloadModalOpen"
      :ui="{ content: 'sm:max-w-2xl', body: 'max-h-[80vh] overflow-y-auto' }"
    >
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <div class="font-semibold">
            {{ t('resources.download_title', { title: resource!.title }) }}
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            @click="downloadModalOpen = false"
          />
        </div>
      </template>
      <template #body>
        <div class="flex flex-col gap-3">
          <UButton
            color="success"
            variant="solid"
            icon="i-lucide-monitor"
          >
            {{ t('resources.client_install_hint') }}
          </UButton>
          <USeparator :label="t('resources.or')" />
          <UCard
            v-if="downloadModalVersion"
            :ui="{ body: 'p-3' }"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-semibold truncate">
                  {{ downloadModalVersion.name }}
                </div>
                <div class="text-xs text-muted">
                  {{ downloadModalVersion.size }} • {{ formatTime(downloadModalVersion.date) }}
                </div>
              </div>
              <UButton
                color="primary"
                size="sm"
                :disabled="(downloadModalVersion.files || []).length === 0"
                :loading="downloadingVersionId === downloadModalVersion.id"
                @click="downloadFile(downloadModalVersion)"
              >
                {{ t('resources.download_this_version') }}
              </UButton>
            </div>
            <div
              v-if="(downloadModalVersion.files || []).length === 0"
              class="mt-2 text-xs text-(--ui-text-muted)"
            >
              {{ t('resources.no_files_for_version') }}
            </div>
            <div
              v-else
              class="mt-3 flex flex-col gap-2"
            >
              <div class="text-xs text-(--ui-text-muted)">
                {{ t('resources.version_files') }}
              </div>
              <div
                v-for="f in (downloadModalVersion.files || [])"
                :key="f.id"
                class="flex items-center justify-between gap-2 border border-(--ui-border) rounded-md px-3 py-2"
              >
                <div class="min-w-0">
                  <div class="flex items-center gap-2 min-w-0">
                    <div class="text-sm font-medium truncate">
                      {{ f.displayName || f.fileName }}
                    </div>
                    <UBadge
                      v-if="f.isPrimary"
                      color="primary"
                      variant="subtle"
                      size="xs"
                    >
                      {{ t('resources.file_primary') }}
                    </UBadge>
                  </div>
                  <div class="text-xs text-muted">
                    {{ formatBytes(f.sizeBytes) }}
                  </div>
                </div>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="outline"
                  :loading="isFileActionLoading(downloadModalVersion.id, f.id)"
                  :disabled="uploadingFile || isFileActionLoading(downloadModalVersion.id, f.id)"
                  @click="downloadVersionFile(downloadModalVersion.id, f.id)"
                >
                  {{ t('resources.download_file') }}
                </UButton>
              </div>
            </div>
          </UCard>
          <UCard
            v-else
            :ui="{ body: 'p-3' }"
          >
            <div class="text-sm text-(--ui-text-muted)">
              {{ t('resources.no_downloadable_files') }}
            </div>
          </UCard>
          <UCard
            v-if="recentDownloadableVersions.length > 1"
            :ui="{ body: 'p-3' }"
          >
            <div class="text-xs text-(--ui-text-muted) mb-2">
              {{ t('resources.other_download_versions') }}
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="v in recentDownloadableVersions"
                :key="v.id"
                size="xs"
                color="neutral"
                variant="outline"
                @click="downloadFile(v)"
              >
                {{ v.name }}
              </UButton>
            </div>
          </UCard>
          <UButton
            color="primary"
            variant="outline"
            icon="i-lucide-arrow-down-to-line"
            @click="activeTab = 'versions'; downloadModalOpen = false"
          >
            {{ hasAnyDownloadableFile ? t('resources.pick_version_manual') : t('resources.go_upload_files') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="editDescOpen"
      :ui="{ content: 'sm:max-w-xl', body: 'max-h-[80vh] overflow-y-auto' }"
    >
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <div class="font-semibold">
            {{ t('resources.edit_description') }}
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            @click="editDescOpen = false"
          />
        </div>
      </template>
      <template #body>
        <div class="space-y-3">
          <UFormField :label="t('resources.description')">
            <UTextarea
              v-model="editDescText"
              :rows="12"
            />
          </UFormField>
          <div class="flex justify-end">
            <UButton
              color="primary"
              :loading="submittingDesc"
              @click="submitDescription"
            >
              {{ t('common.save') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="editUpdateOpen"
      :ui="{ content: 'sm:max-w-xl', body: 'max-h-[80vh] overflow-y-auto' }"
    >
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <div class="font-semibold">
            {{ t('resources.edit_update') }}
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            @click="editUpdateOpen = false"
          />
        </div>
      </template>
      <template #body>
        <div class="space-y-3">
          <UFormField :label="t('resources.update_title')">
            <UInput v-model="editUpdateForm.title" />
          </UFormField>
          <UFormField :label="t('resources.update_version')">
            <UInput v-model="editUpdateForm.versionString" />
          </UFormField>
          <UFormField :label="t('resources.update_type')">
            <USelect
              v-model="editUpdateForm.updateType"
              :items="[
                { label: t('resources.update_type_update'), value: 'update' },
                { label: t('resources.version_type_release'), value: 'release' },
                { label: t('resources.version_type_snapshot'), value: 'snapshot' }
              ]"
              label-key="label"
              value-key="value"
            />
          </UFormField>
          <UFormField :label="t('resources.update_message')">
            <UTextarea
              v-model="editUpdateForm.message"
              :rows="8"
            />
          </UFormField>
          <div class="flex justify-end">
            <UButton
              color="primary"
              :loading="submittingEditUpdate"
              @click="submitEditUpdate"
            >
              {{ t('common.save') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="deleteUpdateOpen"
      :ui="{ content: 'sm:max-w-md' }"
    >
      <template #header>
        <div class="font-semibold">
          {{ t('resources.delete_update') }}
        </div>
      </template>
      <template #body>
        <div class="space-y-4">
          <div class="text-sm text-(--ui-text-muted)">
            {{ t('resources.delete_update_confirm') }}
          </div>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="outline"
              @click="deleteUpdateOpen = false"
            >
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              color="error"
              :loading="deletingUpdate"
              @click="confirmDeleteUpdate"
            >
              {{ t('common.confirm') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="resourceStateConfirmOpen"
      :ui="{ content: 'sm:max-w-md' }"
    >
      <template #header>
        <div class="font-semibold">
          {{ resourceStateConfirmTitle }}
        </div>
      </template>
      <template #body>
        <div class="space-y-4">
          <div class="text-sm text-(--ui-text-muted)">
            {{ resourceStateConfirmDesc }}
          </div>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="outline"
              @click="resourceStateConfirmOpen = false"
            >
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              color="primary"
              :loading="submittingResourceState"
              @click="submitResourceStateChange"
            >
              {{ t('common.confirm') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="basicEditOpen"
      :ui="{ content: 'sm:max-w-2xl', body: 'max-h-[80vh] overflow-y-auto' }"
    >
      <template #header>
        <div class="font-semibold">
          {{ t('resources.edit_basic') }}
        </div>
      </template>
      <template #body>
        <div class="space-y-3">
          <UFormField :label="t('resources.basic_title')">
            <UInput v-model="basicForm.title" />
          </UFormField>
          <UFormField :label="t('resources.basic_tagline')">
            <UInput v-model="basicForm.tagLine" />
          </UFormField>
          <UFormField :label="t('resources.basic_type')">
            <USelect
              v-model="basicForm.resourceType"
              :items="[
                { label: t('resources.publish.type_download'), value: 'download' },
                { label: t('resources.publish.type_external'), value: 'external' },
                { label: t('resources.publish.type_external_purchase'), value: 'external_purchase' },
                { label: t('resources.publish.type_fileless'), value: 'fileless' }
              ]"
              label-key="label"
              value-key="value"
            />
          </UFormField>
          <UFormField :label="t('resources.basic_support_url')">
            <UInput v-model="basicForm.supportUrl" />
          </UFormField>
          <UFormField
            v-if="basicForm.resourceType === 'external' || basicForm.resourceType === 'external_purchase'"
            :label="t('resources.basic_external_url')"
          >
            <UInput v-model="basicForm.externalUrl" />
          </UFormField>
          <UFormField
            v-if="basicForm.resourceType === 'external_purchase'"
            :label="t('resources.basic_purchase_url')"
          >
            <UInput v-model="basicForm.externalPurchaseUrl" />
          </UFormField>
          <div
            v-if="basicForm.resourceType === 'external_purchase'"
            class="grid grid-cols-2 gap-2"
          >
            <UFormField :label="t('resources.basic_price')">
              <UInput
                v-model.number="basicForm.price"
                type="number"
              />
            </UFormField>
            <UFormField :label="t('resources.basic_currency')">
              <UInput v-model="basicForm.currency" />
            </UFormField>
          </div>
          <UFormField :label="t('resources.basic_tags')">
            <UInput
              v-model="basicForm.tagsRaw"
              :placeholder="t('resources.basic_tags_placeholder')"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            :disabled="basicSubmitting"
            @click="basicEditOpen = false"
          >
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            color="primary"
            :loading="basicSubmitting"
            @click="saveBasic"
          >
            {{ t('resources.save_basic') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
