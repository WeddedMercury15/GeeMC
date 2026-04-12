export interface ResourceListItem {
  id: string
  title: string
  categoryKey: string
  description: string
  tags: string[]
  author: string
  authorAvatar: string
  cover: string
  latestVersion: string
  publishedAt: string
  downloads: string
  platform: string
}

export interface ResourceVersion {
  id: number
  name: string
  type: 'release' | 'snapshot'
  date: string
  size: string
  downloads: string
  gameVersions: string[]
  loaders?: string[]
  serverTypes?: string[]
  changelog?: string
  changelogVersion?: string
  hash?: string
}

export interface ResourceLink {
  label: string
  url: string
  icon: string
  type?: string
}

export interface ResourceDetail extends ResourceListItem {
  categoryLabel: string
  platformLabel: string
  icon: string
  followers: string
  updateDate: string
  createDate: string
  license: { name: string, url?: string }
  links: ResourceLink[]
  gallery: { url: string, caption: string }[]
  descriptionHtml: string
  versions: ResourceVersion[]
  changelogs: { version: string, type: 'release' | 'snapshot', date: string, markdownHtml: string, files?: { id: number, name: string }[] }[]
  ratingScore: number
  reviews: { id: number, userName: string, userAvatar: string, rating: number, content: string, likes: number, time: string }[]
}
