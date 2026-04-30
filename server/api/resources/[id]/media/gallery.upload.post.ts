import { count, eq } from 'drizzle-orm'
import { resourceGallery, resources } from '../../../../database/schema'
import { useDb } from '../../../../utils/db'
import { requireGeemcPublish } from '../../../../utils/requireGeemcPublish'
import { storePublicUpload } from '../../../../utils/fileStorage'
import { assertCanManageResource } from '../../../../utils/resourceManagePermissions'
import { assertFileExtAllowed, assertMaxBytes } from '../../../../utils/uploadGuards'

export default defineEventHandler(async (event) => {
  const user = await requireGeemcPublish(event)
  const resourceId = getRouterParam(event, 'id')
  if (!resourceId) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const form = await readMultipartFormData(event)
  const filePart = form?.find(p => p.name === 'file' && !!p.filename)
  const captionPart = form?.find(p => p.name === 'caption' && !p.filename)
  if (!filePart || !('data' in filePart) || !filePart.data) {
    throw createError({ statusCode: 400, statusMessage: 'Missing file' })
  }
  const originalName = filePart.filename || 'gallery.png'
  assertFileExtAllowed(originalName, ['.png', '.jpg', '.jpeg', '.webp', '.gif'], 'image')
  assertMaxBytes(Buffer.byteLength(filePart.data), 10 * 1024 * 1024, 'image')
  const caption = typeof (captionPart as any)?.data === 'string' ? (captionPart as any).data.trim() : ''
  if (caption.length > 140) {
    throw createError({ statusCode: 400, statusMessage: 'Caption is too long (max 140 characters)' })
  }

  const db = await useDb()
  await assertCanManageResource({ db, resourceId, userId: Number(user.id), allowDeleted: false })
  const [galleryCountRow] = await db
    .select({ value: count(resourceGallery.id) })
    .from(resourceGallery)
    .where(eq(resourceGallery.resourceId, resourceId))
  const galleryCount = Number(galleryCountRow?.value ?? 0)
  if (galleryCount >= 20) {
    throw createError({ statusCode: 400, statusMessage: 'Gallery is full (max 20 images)' })
  }

  const stored = await storePublicUpload({
    folder: `resources/${resourceId}/gallery`,
    originalName,
    content: Buffer.from(filePart.data)
  })

  await db.insert(resourceGallery).values({
    resourceId,
    url: stored.publicUrl,
    caption
  })

  return { success: true, url: stored.publicUrl }
})
