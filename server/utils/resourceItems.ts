import { and, desc, eq, inArray, like, or, sql } from 'drizzle-orm'
import { resolveUserAvatarUrl } from './avatarUrl'
import { useDb } from './db'
import { resourceCategories, resourceReviews, resourceTemplates, resourceVersions, resources, users } from '../database/schema'
import type { ResourceListItem } from '../../app/utils/resourceCatalog'

export type ResourceListFilters = {
  edition?: string
  kind?: string
  category?: string
  keyword?: string
  tag?: string
  sort?: 'hot' | 'new' | 'downloads' | 'rating' | 'reviews'
  page?: number
  pageSize?: number
}

function compareScoredRows(
  a: { publishedAt: string, downloadsCount: number, reviewCount: number, ratingScore: number },
  b: { publishedAt: string, downloadsCount: number, reviewCount: number, ratingScore: number },
  sortMode: ResourceListFilters['sort']
) {
  const mode = sortMode ?? 'hot'
  if (mode === 'new') return b.publishedAt.localeCompare(a.publishedAt)
  if (mode === 'downloads') return Number(b.downloadsCount ?? 0) - Number(a.downloadsCount ?? 0)
  if (mode === 'rating') return Number(b.ratingScore ?? 0) - Number(a.ratingScore ?? 0)
  if (mode === 'reviews') return Number(b.reviewCount ?? 0) - Number(a.reviewCount ?? 0)
  const aHot = Number(a.downloadsCount ?? 0) + Number(a.reviewCount ?? 0) * 5 + Number(a.ratingScore ?? 0) * 20
  const bHot = Number(b.downloadsCount ?? 0) + Number(b.reviewCount ?? 0) * 5 + Number(b.ratingScore ?? 0) * 20
  return bHot - aHot
}

export async function getResourceListPage(filters?: ResourceListFilters): Promise<{ items: ResourceListItem[], total: number }> {
  const db = await useDb()
  const page = Math.max(1, Number(filters?.page) || 1)
  const pageSize = Math.min(5000, Math.max(8, Number(filters?.pageSize) || 24))

  const conds = [eq(resources.resourceState, 'visible')]
  if (filters?.edition) conds.push(eq(resources.edition, filters.edition))
  if (filters?.kind) conds.push(eq(resources.kind, filters.kind))
  if (filters?.category) conds.push(eq(resources.categoryKey, filters.category))
  if (filters?.tag) {
    const tag = filters.tag.trim()
    if (tag) {
      if (process.env.DB_TYPE === 'mysql') {
        conds.push(sql`JSON_CONTAINS(${resources.tags}, JSON_QUOTE(${tag}))`)
      } else {
        // sqlite json stored as text; fallback to substring match on JSON string
        const pattern = `%"${tag.replace(/"/g, '')}"%`
        conds.push(sql`${resources.tags} LIKE ${pattern}`)
      }
    }
  }
  if (filters?.keyword) {
    const keywordCond = or(
      like(resources.title, `%${filters.keyword}%`),
      like(resources.description, `%${filters.keyword}%`)
    )
    if (keywordCond) conds.push(keywordCond)
  }

  const base = db
    .select({
      id: resources.id,
      title: resources.title,
      categoryKey: resources.categoryKey,
      platformKey: resources.platformKey,
      edition: resources.edition,
      kind: resources.kind,
      environment: resources.environment,
      description: resources.description,
      tags: resources.tags,
      authorUserId: resources.authorUserId,
      authorUsername: users.username,
      authorGeeIdUserId: users.geeIdUserId,
      cover: resources.cover,
      publishedAt: resources.publishedAt,
      downloadsCount: resources.downloadsCount,
      cardAspectRatio: resourceTemplates.cardAspectRatio
    })
    .from(resources)
    .innerJoin(users, eq(resources.authorUserId, users.id))
    .leftJoin(resourceCategories, eq(resources.categoryKey, resourceCategories.slug))
    .leftJoin(resourceTemplates, eq(resourceCategories.templateId, resourceTemplates.id))

  const rows
    = conds.length > 0
      ? await base.where(and(...conds)).orderBy(desc(resources.publishedAt))
      : await base.orderBy(desc(resources.publishedAt))

  const resourceIds = rows.map(r => r.id)
  const reviewStatsByResourceId = new Map<string, { count: number, sum: number }>()

  if (resourceIds.length > 0) {
    const reviewRows = await db
      .select({
        resourceId: resourceReviews.resourceId,
        rating: resourceReviews.rating
      })
      .from(resourceReviews)
      .where(and(inArray(resourceReviews.resourceId, resourceIds), eq(resourceReviews.reviewState, 'visible')))

    for (const row of reviewRows) {
      const key = row.resourceId
      const prev = reviewStatsByResourceId.get(key) ?? { count: 0, sum: 0 }
      prev.count += 1
      prev.sum += Number(row.rating ?? 0)
      reviewStatsByResourceId.set(key, prev)
    }
  }

  const scoredRows = rows.map((r) => {
    const stats = reviewStatsByResourceId.get(r.id) ?? { count: 0, sum: 0 }
    const reviewCount = stats.count
    const ratingScore = reviewCount > 0 ? stats.sum / reviewCount : 0
    return {
      ...r,
      reviewCount,
      ratingScore
    }
  })

  const orderedRows = [...scoredRows].sort((a, b) => compareScoredRows(a, b, filters?.sort))
  const total = orderedRows.length
  const pageRows = orderedRows.slice((page - 1) * pageSize, page * pageSize)
  const pageResourceIds = pageRows.map(r => r.id)
  const latestVersionByResourceId = new Map<string, string>()
  if (pageResourceIds.length > 0) {
    const versionRows = await db
      .select({
        resourceId: resourceVersions.resourceId,
        name: resourceVersions.name,
        date: resourceVersions.date
      })
      .from(resourceVersions)
      .where(inArray(resourceVersions.resourceId, pageResourceIds))
      .orderBy(desc(resourceVersions.date))
    for (const row of versionRows) {
      if (!latestVersionByResourceId.has(row.resourceId)) latestVersionByResourceId.set(row.resourceId, row.name ?? '')
    }
  }

  const items: ResourceListItem[] = []
  for (const r of pageRows) {
    const latestVersion = latestVersionByResourceId.get(r.id) ?? ''

    items.push({
      id: r.id,
      title: r.title,
      categoryKey: r.categoryKey,
      cardAspectRatio: r.cardAspectRatio ?? undefined,
      description: r.description,
      tags: r.tags ?? [],
      author: r.authorUsername,
      authorAvatar: resolveUserAvatarUrl(null, r.authorGeeIdUserId) ?? '',
      cover: r.cover,
      latestVersion,
      publishedAt: r.publishedAt,
      downloads: String(r.downloadsCount ?? 0),
      reviewCount: r.reviewCount,
      ratingScore: r.ratingScore,
      platform: r.platformKey,
      taxonomy: {
        edition: r.edition ?? 'java',
        kind: r.kind ?? 'mod',
        environment: r.environment ?? 'both'
      }
    })
  }

  return { items, total }
}

export async function getResourceListItems(filters?: ResourceListFilters): Promise<ResourceListItem[]> {
  const result = await getResourceListPage({ ...filters, page: 1, pageSize: 1000 })
  return result.items
}
