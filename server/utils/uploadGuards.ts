import path from 'node:path'

export function assertMaxBytes(bytes: number, maxBytes: number, label: string) {
  const n = Number(bytes ?? 0)
  if (!Number.isFinite(n) || n <= 0) {
    throw createError({ statusCode: 400, statusMessage: `Empty ${label}` })
  }
  if (n > maxBytes) {
    throw createError({ statusCode: 400, statusMessage: `${label} too large` })
  }
}

export function assertFileExtAllowed(fileName: string, allowedExts: string[], label: string) {
  const ext = path.extname(fileName || '').toLowerCase()
  if (!allowedExts.includes(ext)) {
    throw createError({ statusCode: 400, statusMessage: `Unsupported ${label} type` })
  }
}

