import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
}

export default defineEventHandler(async (event) => {
  const rawPath = getRouterParam(event, 'path')
  if (!rawPath) {
    throw createError({ statusCode: 400, statusMessage: 'Missing path' })
  }

  const normalized = normalize(rawPath).replace(/\\/g, '/')
  if (normalized.includes('..')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  const absPath = join(process.cwd(), 'storage', 'uploads', normalized)
  let fileBuffer: Buffer
  try {
    fileBuffer = await readFile(absPath)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  const ext = extname(absPath).toLowerCase()
  const mime = MIME_BY_EXT[ext] || 'application/octet-stream'
  setHeader(event, 'Content-Type', mime)
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return fileBuffer
})
