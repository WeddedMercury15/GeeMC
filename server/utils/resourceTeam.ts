export function normalizeTeamMemberIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(v => Number(v))
    .filter(v => Number.isFinite(v) && v > 0)
}

export function canManageResourceByTeam(params: {
  authorUserId: number | string
  teamMemberUserIds?: unknown
  userId: number | string
}) {
  const authorUserId = Number(params.authorUserId)
  const userId = Number(params.userId)
  if (!Number.isFinite(authorUserId) || !Number.isFinite(userId)) return false
  if (authorUserId === userId) return true
  const team = normalizeTeamMemberIds(params.teamMemberUserIds)
  return team.includes(userId)
}

