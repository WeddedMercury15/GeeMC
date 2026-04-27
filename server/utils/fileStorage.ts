import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type StoredFile = {
  storagePath: string
  publicUrl: string
  sizeBytes: number
  sha256: string
}

export async function storePublicUpload(params: {
  folder: string
  originalName: string
  content: Buffer
}): Promise<StoredFile> {
  const safeName = params.originalName.replace(/[^\w.\-()+\s]/g, '_').slice(0, 120) || 'file'
  const sha256 = createHash('sha256').update(params.content).digest('hex')
  const ext = path.extname(safeName).slice(0, 12)
  const base = path.basename(safeName, ext)
  const fileName = `${base.slice(0, 60)}-${sha256.slice(0, 12)}${ext}`

  const relDir = path.posix.join('storage', 'uploads', params.folder)
  const absDir = path.join(process.cwd(), relDir)
  await mkdir(absDir, { recursive: true })

  const relPath = path.posix.join(relDir, fileName)
  const absPath = path.join(process.cwd(), relPath)
  await writeFile(absPath, params.content)

  const publicUrl = path.posix.join('/api/files', params.folder, fileName)
  return {
    storagePath: relPath,
    publicUrl,
    sizeBytes: params.content.byteLength,
    sha256
  }
}
