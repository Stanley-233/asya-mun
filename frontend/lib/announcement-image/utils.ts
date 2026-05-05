import { parseApiPayload } from '@/lib/api/response-utils'
import type { AnnouncementImageResponse } from '@/lib/api/endpoints/asyaBackendAPI.schemas'

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'svg',
  'avif',
  'heic',
  'heif',
])

export function ensureExtension(filename: string, fileType?: string): string {
  if (!fileType) return filename
  if (filename.toLowerCase().endsWith(`.${fileType.toLowerCase()}`)) return filename
  return `${filename}.${fileType}`
}

export function formatFileSize(size?: number): string {
  if (typeof size !== 'number' || Number.isNaN(size)) return '未知'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

export function getAnnouncementFileDisplayName(meta?: AnnouncementImageResponse | null): string {
  if (!meta) return '公告图片'
  const baseName = meta.fileName?.trim() || '公告图片'
  return ensureExtension(baseName, meta.fileType)
}

export function isImageFile(file: File): boolean {
  const mimeType = (file.type || '').trim().toLowerCase()
  if (mimeType.startsWith('image/')) return true

  const extension = file.name.toLowerCase().split('.').pop() || ''
  return IMAGE_EXTENSIONS.has(extension)
}

export function parseAnnouncementImageMeta(rawResponse: unknown): AnnouncementImageResponse | null {
  return parseApiPayload<AnnouncementImageResponse>(rawResponse)
}
