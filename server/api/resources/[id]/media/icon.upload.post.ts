import { eq } from 'drizzle-orm'
import { resources } from '../../../../database/schema'
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
  if (!filePart || !('data' in filePart) || !filePart.data) {
    throw createError({ statusCode: 400, statusMessage: 'Missing file' })
  }
  const originalName = filePart.filename || 'icon.png'
  assertFileExtAllowed(originalName, ['.png', '.jpg', '.jpeg', '.webp', '.gif'], 'image')
  assertMaxBytes(Buffer.byteLength(filePart.data), 5 * 1024 * 1024, 'image')

  const db = await useDb()
  await assertCanManageResource({ db, resourceId, userId: Number(user.id), allowDeleted: false })

  const stored = await storePublicUpload({
    folder: `resources/${resourceId}/icon`,
    originalName,
    content: Buffer.from(filePart.data)
  })

  const now = new Date().toISOString()
  await db
    .update(resources)
    .set({ icon: stored.publicUrl, updateDate: now, lastUpdate: now })
    .where(eq(resources.id, resourceId))

  return { success: true, url: stored.publicUrl }
})
