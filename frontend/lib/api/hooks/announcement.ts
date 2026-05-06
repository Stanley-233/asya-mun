import { useMutation, useQuery } from '@tanstack/react-query'
import {
  downloadAnnouncementImage,
  getAnnouncementImageInfo,
  updateAnnouncementImage,
} from '../apis/announcement.api'
import type { AnnouncementImageResponse } from '../generated'
import type { MutationHookOptions, QueryHookOptions } from './shared'

export const announcementKeys = {
  info: () => ['/api/announcement/image'] as const,
}

export const getGetAnnouncementImageInfoQueryKey = announcementKeys.info

export function useGetAnnouncementImageInfo<TData = AnnouncementImageResponse | null, TError = unknown>(
  options?: QueryHookOptions<AnnouncementImageResponse | null, TData, TError>,
) {
  return useQuery({
    queryKey: announcementKeys.info(),
    queryFn: getAnnouncementImageInfo,
    ...options?.query,
  })
}

export function useUpdateAnnouncementImage<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<AnnouncementImageResponse, { file: File }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ file }) => updateAnnouncementImage(file),
    ...options?.mutation,
  })
}

export { downloadAnnouncementImage }
