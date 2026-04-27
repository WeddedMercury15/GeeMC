import { and, count, eq } from 'drizzle-orm'
import { resourceVersionFiles } from '../../../../../../database/schema'
import { useDb } from '../../../../../../utils/db'
import { requireGeemcPublish } from '../../../../../../utils/requireGeemcPublish'
import { storePublicUpload } from '../../../../../../utils/fileStorage'
import { assertCanManageVersionFiles } from '../../../../../../utils/resourceFilePermissions'
import { assertMaxBytes } from '../../../../../../utils/uploadGuards'

export default defineEventHandler(async (event) => {
  const user = await requireGeemcPublish(event)
  const resourceId = getRouterParam(event, 'id')
  const versionIdRaw = getRouterParam(event, 'versionId')
  const versionId = Number(versionIdRaw)
  if (!resourceId || !Number.isFinite(versionId) || versionId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid input',
      data: {
        code: 'VALIDATION_ERROR',
        details: [
          { path: 'params.id', message: resourceId ? '' : 'Required' },
          { path: 'params.versionId', message: Number.isFinite(versionId) && versionId > 0 ? '' : 'Expected positive number' }
        ].filter(item => item.message)
      }
    })
  }

  const form = await readMultipartFormData(event)
  const filePart = form?.find(p => p.type === 'file')
  if (!filePart || !('data' in filePart) || !filePart.data) {
    throw createError({ statusCode: 400, statusMessage: 'Missing file' })
  }
  assertMaxBytes(Buffer.byteLength(filePart.data), 200 * 1024 * 1024, 'file')

  const db = await useDb()
  await assertCanManageVersionFiles({ db, resourceId, versionId, userId: Number(user.id) })

  const originalName = filePart.filename || 'file'
  const stored = await storePublicUpload({
    folder: `resources/${resourceId}/versions/${versionId}`,
    originalName,
    content: Buffer.from(filePart.data)
  })

  const [countRow] = await db
    .select({ value: count(resourceVersionFiles.id) })
    .from(resourceVersionFiles)
    .where(and(eq(resourceVersionFiles.resourceId, resourceId), eq(resourceVersionFiles.versionId, versionId)))
  const existingCount = Number(countRow?.value ?? 0)

  const now = new Date().toISOString()
  await db.insert(resourceVersionFiles).values({
    resourceId,
    versionId,
    fileName: originalName,
    displayName: originalName,
    mimeType: 'application/octet-stream',
    sizeBytes: stored.sizeBytes,
    sortOrder: existingCount,
    isPrimary: existingCount === 0,
    storagePath: stored.storagePath,
    publicUrl: stored.publicUrl,
    createdAt: now
  })

  return { success: true, url: stored.publicUrl }
})
