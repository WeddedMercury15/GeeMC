import type { ResourceListItem } from '../../app/utils/resourceCatalog'
import { getForumHotSearchLabels } from './forumSearchHints'
import { getResourceListItems } from './resourceItems'

export type HotSearchTagType = 'all' | 'resource' | 'user' | 'post'

export type HotSearchTag = {
  label: string
  type: HotSearchTagType
}

const MAX_TAGS = 8

function parseDownloads(raw: string): number {
  const s = String(raw ?? '').replace(/,/g, '').trim()
  const n = Number(s.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function normLabel(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

function extractFromResources(items: ResourceListItem[]): HotSearchTag[] {
  if (!items.length) return []

  const scored = items.map(item => ({
    item,
    score: parseDownloads(item.downloads)
  }))
  scored.sort((a, b) => b.score - a.score)

  const out: HotSearchTag[] = []
  const seen = new Set<string>()

  const push = (label: string, type: HotSearchTagType) => {
    const key = normLabel(label).toLowerCase()
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push({ label: normLabel(label), type })
  }

  const top = scored.slice(0, 40)
  for (const { item } of top) {
    push(item.title, 'resource')
    for (const tag of item.tags ?? []) {
      push(tag, 'resource')
    }
  }

  return out
}

export async function computeHotSearchTags(): Promise<HotSearchTag[]> {
  const [items, forumLabels] = await Promise.all([
    getResourceListItems(),
    getForumHotSearchLabels()
  ])

  const fromResources = extractFromResources(items)
  const fromForum: HotSearchTag[] = forumLabels
    .map(normLabel)
    .filter(Boolean)
    .map(label => ({ label, type: 'post' as const }))

  const merged: HotSearchTag[] = []
  const seen = new Set<string>()

  const take = (list: HotSearchTag[]) => {
    for (const t of list) {
      if (merged.length >= MAX_TAGS) return
      const k = t.label.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      merged.push(t)
    }
  }

  take(fromResources)
  take(fromForum)

  return merged
}
