type Entry = { expiresAt: number }

const seen = new Map<string, Entry>()

function cleanup(now: number) {
  // cheap opportunistic cleanup
  if (seen.size < 5000) return
  for (const [k, v] of seen) {
    if (v.expiresAt <= now) seen.delete(k)
  }
}

export function shouldCountResourceView(params: {
  resourceId: string
  actorKey: string
  windowMs?: number
}) {
  const now = Date.now()
  cleanup(now)
  const windowMs = Math.max(10_000, Math.min(24 * 60 * 60 * 1000, params.windowMs ?? 10 * 60 * 1000))
  const key = `${params.resourceId}:${params.actorKey}`
  const hit = seen.get(key)
  if (hit && hit.expiresAt > now) return false
  seen.set(key, { expiresAt: now + windowMs })
  return true
}

