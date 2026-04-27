import { storePublicUpload } from '../../utils/fileStorage'
import { requireGeemcPublish } from '../../utils/requireGeemcPublish'
import { assertFileExtAllowed, assertMaxBytes } from '../../utils/uploadGuards'

export default defineEventHandler(async (event) => {
  const user = await requireGeemcPublish(event)

  const form = await readMultipartFormData(event)
  const filePart = form?.find(p => p.name === 'file' && !!p.filename)
  const kindPart = form?.find(p => p.name === 'kind')
  const kind = kindPart?.data ? Buffer.from(kindPart.data).toString('utf8').trim() : ''

  if (!filePart || !('data' in filePart) || !filePart.data) {
    throw createError({ statusCode: 400, statusMessage: 'Missing file' })
  }
  if (kind !== 'cover' && kind !== 'icon') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid kind' })
  }

  const originalName = filePart.filename || `${kind}.png`
  assertFileExtAllowed(originalName, ['.png', '.jpg', '.jpeg', '.webp', '.gif'], 'image')
  assertMaxBytes(Buffer.byteLength(filePart.data), kind === 'cover' ? 10 * 1024 * 1024 : 5 * 1024 * 1024, 'image')

  const stored = await storePublicUpload({
    folder: `resources/drafts/${user.id}/${kind}`,
    originalName,
    content: Buffer.from(filePart.data)
  })

  return { success: true, url: stored.publicUrl }
})
