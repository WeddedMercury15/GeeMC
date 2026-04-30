export type ResourceFieldChoice = {
  label: string
  iconUrl?: string
}

export type ResourceFieldChoiceValue = string | ResourceFieldChoice

export type ResourceFieldChoiceRecord = Record<string, ResourceFieldChoiceValue>

export type NormalizedResourceFieldChoiceRecord = Record<string, ResourceFieldChoice>

export function normalizeResourceFieldChoices(input: unknown): NormalizedResourceFieldChoiceRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}

  const out: NormalizedResourceFieldChoiceRecord = {}

  for (const [key, rawValue] of Object.entries(input as Record<string, unknown>)) {
    const trimmedKey = String(key || '').trim()
    if (!trimmedKey) continue

    if (typeof rawValue === 'string') {
      const label = rawValue.trim() || trimmedKey
      out[trimmedKey] = { label }
      continue
    }

    if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
      out[trimmedKey] = { label: trimmedKey }
      continue
    }

    const objectValue = rawValue as { label?: unknown, iconUrl?: unknown }
    const label = typeof objectValue.label === 'string' && objectValue.label.trim()
      ? objectValue.label.trim()
      : trimmedKey
    const iconUrl = typeof objectValue.iconUrl === 'string' && objectValue.iconUrl.trim()
      ? objectValue.iconUrl.trim()
      : undefined

    out[trimmedKey] = {
      label,
      ...(iconUrl ? { iconUrl } : {})
    }
  }

  return out
}
