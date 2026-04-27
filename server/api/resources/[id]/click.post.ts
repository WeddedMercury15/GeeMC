import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { resources } from '../../../database/schema'
import { useDb } from '../../../utils/db'
import { assertCanReadResource } from '../../../utils/resourceReadPermissions'

const payloadSchema = z.object({
  type: z.enum(['download', 'external', 'external_purchase', 'fileless']),
  targetUrl: z.string().max(2000).optional()
})

export default defineEventHandler(async (event) => {
  const resourceId = getRouterParam(event, 'id')
  if (!resourceId) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const parsed = payloadSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid input',
      data: {
        code: 'VALIDATION_ERROR',
        details: parsed.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      }
    })
  }

  const db = await useDb()
  await assertCanReadResource({ db, event, resourceId })
  const [row] = await db
    .select({
      id: resources.id,
      externalUrl: resources.externalUrl,
      externalPurchaseUrl: resources.externalPurchaseUrl
    })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Resource not found' })

  const clickType = parsed.data.type
  const url =
    clickType === 'external'
      ? (row.externalUrl || '')
      : clickType === 'external_purchase'
          ? (row.externalPurchaseUrl || '')
          : ''

  // For non-download types, we count a "download" on click like XFRM does.
  if (clickType !== 'download') {
    await db
      .update(resources)
      .set({ downloadsCount: sql`${resources.downloadsCount} + 1` })
      .where(eq(resources.id, resourceId))
  }

  return { success: true, url: url || null }
})
