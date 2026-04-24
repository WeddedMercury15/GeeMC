import { and, count, desc, eq } from 'drizzle-orm'
import { resourceUpdates, resources } from '../../database/schema'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = await useDb()
  const q = getQuery(event)
  const page = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(100, Math.max(10, Number(q.pageSize) || 20))

  const whereVisible = and(
    eq(resources.resourceState, 'visible'),
    eq(resourceUpdates.messageState, 'visible'),
    eq(resourceUpdates.isDescription, false)
  )

  const totalRows = await db
    .select({ count: count() })
    .from(resourceUpdates)
    .innerJoin(resources, eq(resourceUpdates.resourceId, resources.id))
    .where(whereVisible)
  const total = Number(totalRows[0]?.count ?? 0)

  const rows = await db
    .select({
      updateId: resourceUpdates.id,
      resourceId: resourceUpdates.resourceId,
      resourceTitle: resources.title,
      resourceCategoryKey: resources.categoryKey,
      title: resourceUpdates.title,
      versionString: resourceUpdates.versionString,
      message: resourceUpdates.message,
      postDate: resourceUpdates.postDate,
      updateType: resourceUpdates.updateType
    })
    .from(resourceUpdates)
    .innerJoin(resources, eq(resourceUpdates.resourceId, resources.id))
    .where(whereVisible)
    .orderBy(desc(resourceUpdates.postDate), desc(resourceUpdates.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    items: rows.map(r => ({
      id: Number(r.updateId),
      resourceId: r.resourceId,
      resourceTitle: r.resourceTitle,
      resourceCategoryKey: r.resourceCategoryKey,
      title: r.title || '',
      version: r.versionString || '',
      message: r.message || '',
      time: r.postDate,
      updateType: r.updateType || 'update'
    })),
    total,
    page,
    pageSize
  }
})
