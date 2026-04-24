import { and, eq } from 'drizzle-orm'
import { resourceVersions } from '../database/schema'
import { assertCanManageResource } from './resourceManagePermissions'

type DbLike = Awaited<ReturnType<typeof import('./db').useDb>>

export async function assertCanManageVersionFiles(params: {
  db: DbLike
  resourceId: string
  versionId: number
  userId: number
}) {
  const { db, resourceId, versionId, userId } = params
  await assertCanManageResource({ db, resourceId, userId, allowDeleted: false })

  const [verRow] = await db
    .select({ id: resourceVersions.id })
    .from(resourceVersions)
    .where(and(eq(resourceVersions.id, versionId), eq(resourceVersions.resourceId, resourceId)))
    .limit(1)

  if (!verRow) throw createError({ statusCode: 404, statusMessage: 'Version not found' })
}

