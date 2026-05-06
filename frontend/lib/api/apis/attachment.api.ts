import { downloadBlob, uploadMultipart } from '../client'
import { apiRequester } from '../client'
import type {
  AttachmentInfoResponse,
  AttachmentUploadResponse,
} from '../generated'

export async function listAll() {
  return apiRequester.requestProtected<AttachmentInfoResponse[]>({
    path: '/api/attachments',
    method: 'GET',
  })
}

export async function upload(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return uploadMultipart<AttachmentUploadResponse>('/api/attachments', formData, 'POST')
}

export async function getOne1(uuid: string) {
  return apiRequester.requestProtected<AttachmentInfoResponse>({
    path: `/api/attachments/${uuid}`,
    method: 'GET',
  })
}

export async function delete1(uuid: string) {
  return apiRequester.requestProtected<void>({
    path: `/api/attachments/${uuid}`,
    method: 'DELETE',
  })
}

export async function download(uuid: string) {
  return downloadBlob(`/api/attachments/${uuid}/download`)
}
