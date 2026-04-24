export interface ResourceFacetGroup {
  facetKey: string
  facetName: string
  appliesToLevel: 'resource' | 'version'
  items: { slug: string, label: string, iconUrl?: string }[]
}

export interface ResourceTaxonomy {
  edition: string
  kind: string
  environment: string
}

export interface ResourceListItem {
  id: string
  title: string
  categoryKey: string
  cardAspectRatio?: string
  description: string
  tags: string[]
  author: string
  authorAvatar: string
  cover: string
  latestVersion: string
  publishedAt: string
  downloads: string
  ratingScore?: number
  reviewCount?: number
  platform: string
  taxonomy: ResourceTaxonomy
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
  files?: { id: number, fileName: string, displayName: string, url: string, sizeBytes: number, sortOrder: number, isPrimary: boolean }[]
  /** Facet groups with `appliesToLevel: 'version'`. */
  facets: ResourceFacetGroup[]
}

export interface ResourceLink {
  label: string
  url: string
  icon: string
  type?: string
}

export interface ResourceDetail extends ResourceListItem {
  authorUserId?: number
  resourceState?: string
  resourceType: 'download' | 'external' | 'external_purchase' | 'fileless' | string
  tagLine?: string
  externalUrl?: string
  externalPurchaseUrl?: string
  supportUrl?: string
  price?: number
  currency?: string
  categoryLabel: string
  platformLabel: string
  icon: string
  viewCount?: number
  followers: string
  isFollowed?: boolean
  teamMemberUserIds?: number[]
  teamMembers?: { id: number, username: string }[]
  updateDate: string
  createDate: string
  license: { name: string, url?: string }
  links: ResourceLink[]
  gallery: { url: string, caption: string }[]
  descriptionHtml: string
  versions: ResourceVersion[]
  changelogs: {
    id?: number
    title?: string
    version: string
    type: 'release' | 'snapshot'
    date: string
    message?: string
    markdownHtml: string
    updateType?: 'update' | 'release' | 'snapshot' | string
    resourceVersionId?: number | null
    messageState?: 'visible' | 'deleted' | string
    voteCount?: number
    votedByMe?: boolean
    files?: { id: number, name: string }[]
  }[]
  ratingScore: number
  reviews: {
    id: number
    userId: number
    userName: string
    userAvatar: string
    rating: number
    content: string
    likes: number
    likedByMe?: boolean
    time: string
    reviewState?: 'visible' | 'deleted' | string
    reply?: {
      userId: number
      userName: string
      userAvatar: string
      message: string
      createdAt: string
      updatedAt: string
    }
  }[]
  /** Facet groups attached to the resource (`appliesToLevel: 'resource'`). */
  resourceFacets: ResourceFacetGroup[]
}
