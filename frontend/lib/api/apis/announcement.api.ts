import { downloadBlob, uploadMultipart } from '../client'
import { apiRequester } from '../client'
import type { AnnouncementImageResponse } from '../generated'

export async function getAnnouncementImageInfo() {
  return apiRequester.requestProtected<AnnouncementImageResponse | null>({
    path: '/api/announcement/image',
    method: 'GET',
  })
}

export async function updateAnnouncementImage(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return uploadMultipart<AnnouncementImageResponse>('/api/announcement/image', formData, 'PUT')
}

export async function downloadAnnouncementImage() {
  return downloadBlob('/api/announcement/image/download')
}
