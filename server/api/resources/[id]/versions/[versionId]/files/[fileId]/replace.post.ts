import { and, eq } from 'drizzle-orm'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { resourceVersionFiles } from '../../../../../../../database/schema'
import { useDb } from '../../../../../../../utils/db'
import { requireGeemcPublish } from '../../../../../../../utils/requireGeemcPublish'
import { storePublicUpload } from '../../../../../../../utils/fileStorage'
import { assertCanManageVersionFiles } from '../../../../../../../utils/resourceFilePermissions'
import { assertMaxBytes } from '../../../../../../../utils/uploadGuards'

export default defineEventHandler(async (event) => {
  const user = await requireGeemcPublish(event)
  const resourceId = getRouterParam(event, 'id')
  const versionIdRaw = getRouterParam(event, 'versionId')
  const fileIdRaw = getRouterParam(event, 'fileId')
  const versionId = Number(versionIdRaw)
  const fileId = Number(fileIdRaw)
  if (!resourceId || !Number.isFinite(versionId) || versionId <= 0 || !Number.isFinite(fileId) || fileId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  }

  const form = await readMultipartFormData(event)
  const filePart = form?.find(p => p.type === 'file')
  if (!filePart || !('data' in filePart) || !filePart.data) {
    throw createError({ statusCode: 400, statusMessage: 'Missing file' })
  }
  assertMaxBytes(Buffer.byteLength(filePart.data), 200 * 1024 * 1024, 'file')

  const db = await useDb()
  await assertCanManageVersionFiles({ db, resourceId, versionId, userId: Number(user.id) })

  const [oldRow] = await db
    .select({ storagePath: resourceVersionFiles.storagePath })
    .from(resourceVersionFiles)
    .where(and(
      eq(resourceVersionFiles.id, fileId),
      eq(resourceVersionFiles.resourceId, resourceId),
      eq(resourceVersionFiles.versionId, versionId)
    ))
    .limit(1)
  if (!oldRow) throw createError({ statusCode: 404, statusMessage: 'File not found' })

  const originalName = filePart.filename || 'file'
  const stored = await storePublicUpload({
    folder: `resources/${resourceId}/versions/${versionId}`,
    originalName,
    content: Buffer.from(filePart.data)
  })

  await db
    .update(resourceVersionFiles)
    .set({
      fileName: originalName,
      sizeBytes: stored.sizeBytes,
      storagePath: stored.storagePath,
      publicUrl: stored.publicUrl
    })
    .where(eq(resourceVersionFiles.id, fileId))

  const abs = path.join(process.cwd(), oldRow.storagePath)
  await unlink(abs).catch(() => {})

  return { success: true, url: stored.publicUrl }
})

