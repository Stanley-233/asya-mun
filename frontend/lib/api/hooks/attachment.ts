import { useMutation, useQuery } from '@tanstack/react-query'
import { delete1, download, getOne1, listAll, upload } from '../apis/attachment.api'
import type {
  AttachmentInfoResponse,
  AttachmentUploadResponse,
} from '../generated'
import type { MutationHookOptions, QueryHookOptions } from './shared'

export const attachmentKeys = {
  listAll: () => ['/api/attachments'] as const,
  detail: (uuid: string) => ['/api/attachments', uuid] as const,
}

export const getListAllQueryKey = attachmentKeys.listAll
export const getGetOne1QueryKey = (uuid: string) => attachmentKeys.detail(uuid)

export function useListAll<TData = AttachmentInfoResponse[], TError = unknown>(
  options?: QueryHookOptions<AttachmentInfoResponse[], TData, TError>,
) {
  return useQuery({
    queryKey: attachmentKeys.listAll(),
    queryFn: listAll,
    ...options?.query,
  })
}

export function useGetOne1<TData = AttachmentInfoResponse, TError = unknown>(
  uuid: string,
  options?: QueryHookOptions<AttachmentInfoResponse, TData, TError>,
) {
  return useQuery({
    queryKey: attachmentKeys.detail(uuid),
    queryFn: () => getOne1(uuid),
    enabled: !!uuid,
    ...options?.query,
  })
}

export function useUpload<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<AttachmentUploadResponse, { file: File }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ file }) => upload(file),
    ...options?.mutation,
  })
}

export function useDelete1<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { uuid: string }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ uuid }) => delete1(uuid),
    ...options?.mutation,
  })
}

export { getOne1 }
export { download }
