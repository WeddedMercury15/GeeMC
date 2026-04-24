import { alias, and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { resourceReviewReplies, resourceReviews, resourceReviewVotes, resources, users } from '../../../../../database/schema'
import { resolveUserAvatarUrl } from '../../../../../utils/avatarUrl'
import { useDb } from '../../../../../utils/db'
import { getCurrentUser } from '../../../../../utils/auth'
import { canManageResourceByTeam } from '../../../../../utils/resourceTeam'
import { resolveUserGroupClaims } from '../../../../../utils/userGroupClaims'

type ReviewOrder = 'rating_date' | 'vote_score' | 'rating'
type ReviewDirection = 'asc' | 'desc'

export default defineEventHandler(async (event) => {
  const resourceId = getRouterParam(event, 'id')
  if (!resourceId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

  const q = getQuery(event)
  const page = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(100, Math.max(10, Number(q.pageSize) || 20))
  const ratingFilter = Math.max(0, Math.min(5, Number(q.rating) || 0))
  const order: ReviewOrder = q.order === 'vote_score' || q.order === 'rating' ? q.order : 'rating_date'
  const direction: ReviewDirection = q.direction === 'asc' ? 'asc' : 'desc'

  const db = await useDb()
  const currentUser = await getCurrentUser(event)
  const [resourceRow] = await db
    .select({
      id: resources.id,
      title: resources.title,
      categoryKey: resources.categoryKey,
      resourceState: resources.resourceState,
      authorUserId: resources.authorUserId,
      teamMemberUserIds: resources.teamMemberUserIds
    })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)

  if (!resourceRow || resourceRow.resourceState !== 'visible') {
    throw createError({ statusCode: 404, statusMessage: 'Resource not found' })
  }
  const currentUserPerms = currentUser
    ? (await resolveUserGroupClaims(db, currentUser.id)).permissions
    : []
  const canReplyAsManager = !!currentUser && (
    currentUserPerms.includes('geemc.admin') || canManageResourceByTeam({
      authorUserId: resourceRow.authorUserId,
      teamMemberUserIds: resourceRow.teamMemberUserIds,
      userId: currentUser.id
    })
  )

  const whereConds = [eq(resourceReviews.resourceId, resourceId), eq(resourceReviews.reviewState, 'visible')]
  if (ratingFilter >= 1 && ratingFilter <= 5) {
    whereConds.push(eq(resourceReviews.rating, ratingFilter))
  }
  const whereExpr = and(...whereConds)

  const totalRows = await db
    .select({ count: count() })
    .from(resourceReviews)
    .where(whereExpr)
  const total = Number(totalRows[0]?.count ?? 0)

  const orderByExpr = (() => {
    if (order === 'vote_score') {
      return direction === 'asc'
        ? [sql`${resourceReviews.likes} asc`, sql`${resourceReviews.id} asc`]
        : [desc(resourceReviews.likes), desc(resourceReviews.id)]
    }
    if (order === 'rating') {
      return direction === 'asc'
        ? [sql`${resourceReviews.rating} asc`, sql`${resourceReviews.id} asc`]
        : [desc(resourceReviews.rating), desc(resourceReviews.id)]
    }
    return direction === 'asc'
      ? [sql`${resourceReviews.time} asc`, sql`${resourceReviews.id} asc`]
      : [desc(resourceReviews.time), desc(resourceReviews.id)]
  })()

  const rows = await db
    .select({
      id: resourceReviews.id,
      userId: resourceReviews.userId,
      userName: users.username,
      userGeeIdUserId: users.geeIdUserId,
      rating: resourceReviews.rating,
      content: resourceReviews.content,
      likes: resourceReviews.likes,
      time: resourceReviews.time
    })
    .from(resourceReviews)
    .innerJoin(users, eq(resourceReviews.userId, users.id))
    .where(whereExpr)
    .orderBy(...orderByExpr)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const reviewIds = rows.map(r => Number(r.id)).filter(v => Number.isFinite(v) && v > 0)
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

  return {
    resource: {
      id: resourceRow.id,
      title: resourceRow.title,
      categoryKey: resourceRow.categoryKey,
      canReplyAsManager
    },
    items: rows.map(r => ({
      id: Number(r.id),
      userId: Number(r.userId),
      userName: r.userName,
      userAvatar: resolveUserAvatarUrl(null, r.userGeeIdUserId) ?? '',
      rating: Number(r.rating ?? 0),
      content: r.content,
      likes: Number(r.likes ?? 0),
      likedByMe: likedReviewIds.has(Number(r.id)),
      time: r.time,
      reply: repliesByReviewId.get(Number(r.id))
    })),
    total,
    page,
    pageSize,
    filters: {
      rating: ratingFilter >= 1 && ratingFilter <= 5 ? ratingFilter : null,
      order,
      direction
    }
  }
})
