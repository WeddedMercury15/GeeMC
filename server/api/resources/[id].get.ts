import { alias, and, desc, eq, inArray } from 'drizzle-orm'
import type { ResourceDetail, ResourceVersion } from '../../../app/utils/resourceCatalog'
import { resourceCategories, resourceFollows, resourceGallery, resourceLinks, resourceReviewReplies, resourceReviews, resourceReviewVotes, resourceTemplates, resourceUpdates, resourceUpdateVotes, resourceVersionFiles, resourceVersions, resources, users } from '../../database/schema'
import { getCurrentUser } from '../../utils/auth'
import { resolveUserAvatarUrl } from '../../utils/avatarUrl'
import { useDb } from '../../utils/db'
import { canManageResourceByTeam } from '../../utils/resourceTeam'
import { resolveUserGroupClaims } from '../../utils/userGroupClaims'

const PLATFORM_LABELS: Record<string, string> = {
  java: 'Java',
  bedrock: 'Bedrock'
}

function mapPlatformLabel(platformKey: string) {
  return PLATFORM_LABELS[platformKey] ?? platformKey
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

  const db = await useDb()
  const query = getQuery(event)
  const includeDeletedRequested = query.includeDeleted === '1'
  const currentUser = await getCurrentUser(event)
  const currentUserPerms = currentUser
    ? (await resolveUserGroupClaims(db, currentUser.id)).permissions
    : []

  const [resourceRow] = await db
    .select({
      id: resources.id,
      title: resources.title,
      categoryKey: resources.categoryKey,
      categoryLabel: resourceCategories.name,
      categoryTemplateAspectRatio: resourceTemplates.cardAspectRatio,
      platformKey: resources.platformKey,
      tagLine: resources.tagLine,
      resourceType: resources.resourceType,
      resourceState: resources.resourceState,
      externalUrl: resources.externalUrl,
      externalPurchaseUrl: resources.externalPurchaseUrl,
      supportUrl: resources.supportUrl,
      price: resources.price,
      currency: resources.currency,
      edition: resources.edition,
      kind: resources.kind,
      environment: resources.environment,
      description: resources.description,
      descriptionHtml: resources.descriptionHtml,
      cover: resources.cover,
      icon: resources.icon,
      authorUserId: resources.authorUserId,
      authorUsername: users.username,
      authorGeeIdUserId: users.geeIdUserId,
      createDate: resources.createDate,
      updateDate: resources.updateDate,
      publishedAt: resources.publishedAt,
      downloadsCount: resources.downloadsCount,
      viewCount: resources.viewCount,
      followersCount: resources.followersCount,
      teamMemberUserIds: resources.teamMemberUserIds,
      tags: resources.tags,
      licenseName: resources.licenseName,
      licenseUrl: resources.licenseUrl
    })
    .from(resources)
    .innerJoin(users, eq(resources.authorUserId, users.id))
    .leftJoin(resourceCategories, eq(resources.categoryKey, resourceCategories.slug))
    .leftJoin(resourceTemplates, eq(resourceCategories.templateId, resourceTemplates.id))
    .where(eq(resources.id, id))
    .limit(1)

  if (!resourceRow) {
    throw createError({ statusCode: 404, statusMessage: 'Resource not found' })
  }

  const canViewNonVisible
    = !!currentUser
      && currentUserPerms.includes('geemc.publish')
      && canManageResourceByTeam({
        authorUserId: resourceRow.authorUserId,
        teamMemberUserIds: resourceRow.teamMemberUserIds,
        userId: currentUser.id
      })

  if (resourceRow.resourceState !== 'visible' && !canViewNonVisible) {
    throw createError({ statusCode: 404, statusMessage: 'Resource not found' })
  }

  const versionsRows = await db
    .select({
      id: resourceVersions.id,
      name: resourceVersions.name,
      type: resourceVersions.type,
      date: resourceVersions.date,
      size: resourceVersions.size,
      downloadsCount: resourceVersions.downloadsCount,
      hash: resourceVersions.hash,
      gameVersions: resourceVersions.gameVersions,
      loaders: resourceVersions.loaders,
      serverTypes: resourceVersions.serverTypes
    })
    .from(resourceVersions)
    .where(eq(resourceVersions.resourceId, id))
    .orderBy(desc(resourceVersions.date))

  const versions: ResourceVersion[] = versionsRows.map((v) => {
    const mappedType = v.type === 'snapshot' ? 'snapshot' : 'release'
    const loaders = Array.isArray(v.loaders) && v.loaders.length > 0 ? v.loaders : undefined
    const serverTypes = Array.isArray(v.serverTypes) && v.serverTypes.length > 0 ? v.serverTypes : undefined

    return {
      id: v.id,
      name: v.name,
      type: mappedType,
      date: v.date,
      size: v.size,
      downloads: String(v.downloadsCount ?? 0),
      gameVersions: Array.isArray(v.gameVersions) ? v.gameVersions : [],
      loaders,
      serverTypes,
      hash: v.hash ?? undefined,
      facets: []
    }
  })

  const versionFileRows = await db
    .select({
      id: resourceVersionFiles.id,
      versionId: resourceVersionFiles.versionId,
      fileName: resourceVersionFiles.fileName,
      displayName: resourceVersionFiles.displayName,
      sizeBytes: resourceVersionFiles.sizeBytes,
      sortOrder: resourceVersionFiles.sortOrder,
      isPrimary: resourceVersionFiles.isPrimary,
      publicUrl: resourceVersionFiles.publicUrl
    })
    .from(resourceVersionFiles)
    .where(eq(resourceVersionFiles.resourceId, id))
    .orderBy(desc(resourceVersionFiles.isPrimary), resourceVersionFiles.sortOrder, desc(resourceVersionFiles.id))
  const filesByVersion = new Map<number, { id: number, fileName: string, displayName: string, url: string, sizeBytes: number, sortOrder: number, isPrimary: boolean }[]>()
  for (const r of versionFileRows) {
    const vid = Number(r.versionId)
    const list = filesByVersion.get(vid) ?? []
    list.push({
      id: Number(r.id),
      fileName: r.fileName,
      displayName: (r.displayName || r.fileName) as string,
      url: r.publicUrl,
      sizeBytes: Number(r.sizeBytes ?? 0),
      sortOrder: Number(r.sortOrder ?? 0),
      isPrimary: Boolean(r.isPrimary)
    })
    filesByVersion.set(vid, list)
  }
  for (const v of versions) {
    v.files = filesByVersion.get(Number(v.id)) ?? []
  }

  const updateRows = await db
    .select({
      id: resourceUpdates.id,
      resourceVersionId: resourceUpdates.resourceVersionId,
      title: resourceUpdates.title,
      message: resourceUpdates.message,
      messageHtml: resourceUpdates.messageHtml,
      postDate: resourceUpdates.postDate,
      updateType: resourceUpdates.updateType,
      isDescription: resourceUpdates.isDescription,
      versionString: resourceUpdates.versionString,
      messageState: resourceUpdates.messageState
    })
    .from(resourceUpdates)
    .where(eq(resourceUpdates.resourceId, id))
    .orderBy(desc(resourceUpdates.postDate), desc(resourceUpdates.id))

  const canSeeDeleted
    = includeDeletedRequested
      && currentUser
      && currentUserPerms.includes('geemc.publish')
      && canManageResourceByTeam({
        authorUserId: resourceRow.authorUserId,
        teamMemberUserIds: resourceRow.teamMemberUserIds,
        userId: currentUser.id
      })

  const visibleUpdates = canSeeDeleted ? updateRows : updateRows.filter(u => u.messageState === 'visible')
  const descUpdate = visibleUpdates.find(u => u.isDescription)
  const updateLogs = visibleUpdates.filter(u => !u.isDescription)
  const updateIds = updateLogs.map(u => Number(u.id)).filter(v => Number.isFinite(v) && v > 0)
  const updateVoteCountById = new Map<number, number>()
  const votedUpdateIds = new Set<number>()
  if (updateIds.length > 0) {
    const voteRows = await db
      .select({ updateId: resourceUpdateVotes.updateId })
      .from(resourceUpdateVotes)
      .where(inArray(resourceUpdateVotes.updateId, updateIds))
    for (const row of voteRows) {
      const key = Number(row.updateId)
      updateVoteCountById.set(key, Number(updateVoteCountById.get(key) ?? 0) + 1)
    }
    if (currentUser) {
      const ownVoteRows = await db
        .select({ updateId: resourceUpdateVotes.updateId })
        .from(resourceUpdateVotes)
        .where(and(eq(resourceUpdateVotes.userId, currentUser.id), inArray(resourceUpdateVotes.updateId, updateIds)))
      for (const row of ownVoteRows) votedUpdateIds.add(Number(row.updateId))
    }
  }

  const changelogs = updateLogs.map(u => ({
    id: u.id,
    title: u.title || undefined,
    version: u.versionString || u.title || '',
    type: (u.updateType === 'snapshot' ? 'snapshot' : 'release') as 'release' | 'snapshot',
    date: u.postDate,
    message: u.message,
    markdownHtml: u.messageHtml,
    updateType: u.updateType as 'update' | 'release' | 'snapshot' | string,
    messageState: u.messageState,
    resourceVersionId: u.resourceVersionId ?? null,
    voteCount: Number(updateVoteCountById.get(Number(u.id)) ?? 0),
    votedByMe: votedUpdateIds.has(Number(u.id))
  }))

  const galleryRows = await db
    .select({
      url: resourceGallery.url,
      caption: resourceGallery.caption
    })
    .from(resourceGallery)
    .where(eq(resourceGallery.resourceId, id))
    .orderBy(resourceGallery.id)

  const gallery = galleryRows.map(g => ({
    url: g.url,
    caption: g.caption ?? ''
  }))

  const linkRows = await db
    .select({
      label: resourceLinks.label,
      url: resourceLinks.url,
      icon: resourceLinks.icon,
      type: resourceLinks.type
    })
    .from(resourceLinks)
    .where(eq(resourceLinks.resourceId, id))
    .orderBy(resourceLinks.id)

  const links = linkRows.map(l => ({
    label: l.label,
    url: l.url,
    icon: l.icon,
    type: l.type ?? undefined
  }))

  const reviewsRows = await db
    .select({
      id: resourceReviews.id,
      userId: resourceReviews.userId,
      userName: users.username,
      userGeeIdUserId: users.geeIdUserId,
      rating: resourceReviews.rating,
      content: resourceReviews.content,
      likes: resourceReviews.likes,
      reviewState: resourceReviews.reviewState,
      time: resourceReviews.time
    })
    .from(resourceReviews)
    .innerJoin(users, eq(resourceReviews.userId, users.id))
    .where(eq(resourceReviews.resourceId, id))
    .orderBy(desc(resourceReviews.time))
  const visibleReviewsRows = canSeeDeleted ? reviewsRows : reviewsRows.filter(r => r.reviewState === 'visible')

  const reviewIds = visibleReviewsRows.map(r => Number(r.id)).filter(v => Number.isFinite(v) && v > 0)
  const likedReviewIds = new Set<number>()
  if (currentUser && reviewIds.length > 0) {
    const voteRows = await db
      .select({ reviewId: resourceReviewVotes.reviewId })
      .from(resourceReviewVotes)
      .where(and(eq(resourceReviewVotes.userId, currentUser.id), inArray(resourceReviewVotes.reviewId, reviewIds)))
    for (const vote of voteRows) likedReviewIds.add(Number(vote.reviewId))
  }
  const repliesByReviewId = new Map<number, { userId: number, userName: string, userAvatar: string, message: string, createdAt: string, updatedAt: string }>()
  if (reviewIds.length > 0) {
    const replier = alias(users, 'replier')
    const replyRows = await db
      .select({
        reviewId: resourceReviewReplies.reviewId,
        userId: resourceReviewReplies.replierUserId,
        userName: replier.username,
        userGeeIdUserId: replier.geeIdUserId,
        message: resourceReviewReplies.message,
        createdAt: resourceReviewReplies.createdAt,
        updatedAt: resourceReviewReplies.updatedAt
      })
      .from(resourceReviewReplies)
      .innerJoin(replier, eq(resourceReviewReplies.replierUserId, replier.id))
      .where(inArray(resourceReviewReplies.reviewId, reviewIds))
    for (const row of replyRows) {
      repliesByReviewId.set(Number(row.reviewId), {
        userId: Number(row.userId),
        userName: row.userName,
        userAvatar: resolveUserAvatarUrl(null, row.userGeeIdUserId) ?? '',
        message: row.message,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      })
    }
  }

  const reviews = visibleReviewsRows.map(r => ({
    id: r.id,
    userId: Number(r.userId),
    userName: r.userName,
    userAvatar: resolveUserAvatarUrl(null, r.userGeeIdUserId) ?? '',
    rating: r.rating,
    content: r.content,
    likes: r.likes ?? 0,
    likedByMe: likedReviewIds.has(Number(r.id)),
    time: r.time,
    reviewState: r.reviewState,
    reply: repliesByReviewId.get(Number(r.id))
  }))

  const ratingScore
    = reviews.length > 0 ? reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length : 0
  let isFollowed = false
  if (currentUser) {
    const [followRow] = await db
      .select({ userId: resourceFollows.userId })
      .from(resourceFollows)
      .where(and(eq(resourceFollows.resourceId, id), eq(resourceFollows.userId, currentUser.id)))
      .limit(1)
    isFollowed = !!followRow
  }
  const teamMemberIds = Array.isArray(resourceRow.teamMemberUserIds)
    ? resourceRow.teamMemberUserIds.map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0)
    : []
  let teamMembers: Array<{ id: number, username: string }> = []
  if (teamMemberIds.length > 0) {
    const memberRows = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.id, teamMemberIds))
    teamMembers = memberRows.map(r => ({ id: Number(r.id), username: r.username }))
  }

  const latestVersion = versions[0]?.name ?? ''

  const edition = resourceRow.edition ?? resourceRow.platformKey ?? 'java'

  const detail: ResourceDetail = {
    id: resourceRow.id,
    title: resourceRow.title,
    tagLine: resourceRow.tagLine ?? '',
    categoryKey: resourceRow.categoryKey,
    categoryLabel: resourceRow.categoryLabel ?? resourceRow.categoryKey,
    authorUserId: Number(resourceRow.authorUserId),
    resourceType: resourceRow.resourceType ?? 'download',
    resourceState: resourceRow.resourceState ?? 'visible',
    externalUrl: resourceRow.externalUrl || undefined,
    externalPurchaseUrl: resourceRow.externalPurchaseUrl || undefined,
    supportUrl: resourceRow.supportUrl || undefined,
    price: resourceRow.price ?? 0,
    currency: resourceRow.currency || undefined,
    platform: resourceRow.platformKey,
    platformLabel: mapPlatformLabel(edition),
    taxonomy: {
      edition,
      kind: resourceRow.kind ?? 'mod',
      environment: resourceRow.environment ?? 'both'
    },
    resourceFacets: [],
    description: resourceRow.tagLine || resourceRow.description,
    tags: Array.isArray(resourceRow.tags) ? resourceRow.tags : [],
    author: resourceRow.authorUsername,
    authorAvatar: resolveUserAvatarUrl(null, resourceRow.authorGeeIdUserId) ?? '',
    cover: resourceRow.cover,
    cardAspectRatio: resourceRow.categoryTemplateAspectRatio ?? undefined,
    icon: resourceRow.icon,
    latestVersion,
    publishedAt: resourceRow.publishedAt,
    downloads: String(resourceRow.downloadsCount ?? 0),
    viewCount: Number(resourceRow.viewCount ?? 0),
    followers: String(resourceRow.followersCount ?? 0),
    isFollowed,
    teamMemberUserIds: teamMemberIds,
    teamMembers,
    updateDate: updateLogs[0]?.postDate ?? resourceRow.updateDate,
    createDate: resourceRow.createDate,
    license: {
      name: resourceRow.licenseName ?? '',
      url: resourceRow.licenseUrl ?? undefined
    },
    links,
    gallery,
    descriptionHtml: descUpdate?.messageHtml ?? resourceRow.descriptionHtml,
    versions,
    changelogs,
    ratingScore,
    reviews
  }

  return detail
})
