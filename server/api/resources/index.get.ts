import { getResourceListPage } from '../../utils/resourceItems'
import { resourceCategories } from '../../database/schema'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = await useDb()
  const q = getQuery(event)
  const edition = typeof q.edition === 'string' && q.edition ? q.edition : undefined
  const kind = typeof q.kind === 'string' && q.kind ? q.kind : undefined
  const category = typeof q.category === 'string' && q.category ? q.category : undefined
  const keyword = typeof q.keyword === 'string' && q.keyword.trim() ? q.keyword.trim() : undefined
  const tag = typeof q.tag === 'string' && q.tag.trim() ? q.tag.trim() : undefined
  const sort = typeof q.sort === 'string' && q.sort
    ? q.sort as 'hot' | 'new' | 'downloads' | 'rating' | 'reviews'
    : undefined
  const page = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(100, Math.max(8, Number(q.pageSize) || 24))

  const { items, total } = await getResourceListPage({ edition, kind, category, keyword, tag, sort, page, pageSize })
  const categories = await db
    .select({
      id: resourceCategories.id,
      name: resourceCategories.name,
      slug: resourceCategories.slug,
      parentCategoryId: resourceCategories.parentCategoryId,
      icon: resourceCategories.icon,
      resourcesCount: resourceCategories.resourceCount
    })
    .from(resourceCategories)
    .orderBy(resourceCategories.id)

  return {
    items,
    total,
    page,
    pageSize,
    categories: categories.map(c => ({
      ...c,
      resourcesCount: Number(c.resourcesCount ?? 0)
    }))
  }
})
