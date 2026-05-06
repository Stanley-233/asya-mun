import { useMutation, useQuery } from '@tanstack/react-query'
import { getAll1, getCurrent, getLatest, jump, update3 } from '../apis/timeline.api'
import type {
  CurrentTimeResponse,
  TimeAnchorResponse,
  TimeJumpRequest,
  TimeUpdateRequest,
} from '../generated'
import type { MutationHookOptions, QueryHookOptions } from './shared'

export const timelineKeys = {
  all: () => ['/api/time'] as const,
  latest: () => ['/api/time/latest'] as const,
  current: () => ['/api/time/current'] as const,
}

export const getGetAll1QueryKey = timelineKeys.all
export const getGetLatestQueryKey = timelineKeys.latest
export const getGetCurrentQueryKey = timelineKeys.current

export function useGetAll1<TData = TimeAnchorResponse[], TError = unknown>(
  options?: QueryHookOptions<TimeAnchorResponse[], TData, TError>,
) {
  return useQuery({
    queryKey: timelineKeys.all(),
    queryFn: getAll1,
    ...options?.query,
  })
}

export function useGetLatest<TData = TimeAnchorResponse, TError = unknown>(
  options?: QueryHookOptions<TimeAnchorResponse, TData, TError>,
) {
  return useQuery({
    queryKey: timelineKeys.latest(),
    queryFn: getLatest,
    ...options?.query,
  })
}

export function useGetCurrent<TData = CurrentTimeResponse, TError = unknown>(
  options?: QueryHookOptions<CurrentTimeResponse, TData, TError>,
) {
  return useQuery({
    queryKey: timelineKeys.current(),
    queryFn: getCurrent,
    ...options?.query,
  })
}

export function useUpdate3<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { data: TimeUpdateRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ data }) => update3(data),
    ...options?.mutation,
  })
}

export function useJump<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { data: TimeJumpRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ data }) => jump(data),
    ...options?.mutation,
  })
}
