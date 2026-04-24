import { and, desc, eq } from 'drizzle-orm'
import { resourceCategories, resources } from '../database/schema'

type DbLike = {
  select: any
  update: any
}

export async function recalcAndUpdateCategoryLastResource(db: DbLike, categorySlug: string) {
  const visibleRows = await db
    .select({
      id: resources.id,
      title: resources.title,
      lastUpdate: resources.lastUpdate,
      updateDate: resources.updateDate
    })
    .from(resources)
    .where(and(eq(resources.categoryKey, categorySlug), eq(resources.resourceState, 'visible')))
    .orderBy(desc(resources.lastUpdate), desc(resources.updateDate), desc(resources.publishedAt))

  const latest = visibleRows[0]
  const resourceCount = visibleRows.length

  const lastUpdate = latest?.lastUpdate || latest?.updateDate || '0'
  const lastResourceId = latest?.id ?? ''
  const lastResourceTitle = latest?.title ?? ''

  await db
    .update(resourceCategories)
    .set({
      resourceCount,
      lastUpdate,
      lastResourceId,
      lastResourceTitle
    })
    .where(eq(resourceCategories.slug, categorySlug))
}

