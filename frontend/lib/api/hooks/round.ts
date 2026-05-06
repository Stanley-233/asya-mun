import { useMutation, useQuery } from '@tanstack/react-query'
import {
  current,
  detail,
  list,
  pause,
  publish,
  resume,
  setNext,
  update,
  updateCurrent,
  updateRemaining,
} from '../apis/round.api'
import type {
  RoundPublishRequest,
  RoundResponse,
  RoundSetCurrentRequest,
  RoundSetNextRequest,
  RoundSetRemainingRequest,
  RoundUpdateRequest,
} from '../generated'
import type { MutationHookOptions, QueryHookOptions } from './shared'

export const roundKeys = {
  detail: (roundId: string) => ['/api/round', roundId] as const,
  current: () => ['/api/round/current'] as const,
  list: () => ['/api/round'] as const,
}

export const getDetailQueryKey = (roundId: string) => roundKeys.detail(roundId)
export const getCurrentQueryKey = roundKeys.current
export const getListQueryKey = roundKeys.list

export function useDetail<TData = RoundResponse, TError = unknown>(
  roundId: string,
  options?: QueryHookOptions<RoundResponse, TData, TError>,
) {
  return useQuery({
    queryKey: roundKeys.detail(roundId),
    queryFn: () => detail(roundId),
    enabled: !!roundId,
    ...options?.query,
  })
}

export function useCurrent<TData = RoundResponse, TError = unknown>(
  options?: QueryHookOptions<RoundResponse, TData, TError>,
) {
  return useQuery({
    queryKey: roundKeys.current(),
    queryFn: current,
    ...options?.query,
  })
}

export function useList<TData = RoundResponse[], TError = unknown>(
  options?: QueryHookOptions<RoundResponse[], TData, TError>,
) {
  return useQuery({
    queryKey: roundKeys.list(),
    queryFn: list,
    ...options?.query,
  })
}

export function useUpdate<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { roundId: string; data: RoundUpdateRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ roundId, data }) => update(roundId, data),
    ...options?.mutation,
  })
}

export function useUpdateRemaining<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { roundId: string; data: RoundSetRemainingRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ roundId, data }) => updateRemaining(roundId, data),
    ...options?.mutation,
  })
}

export function useSetNext<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { roundId: string; data: RoundSetNextRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ roundId, data }) => setNext(roundId, data),
    ...options?.mutation,
  })
}

export function useUpdateCurrent<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { data: RoundSetCurrentRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ data }) => updateCurrent(data),
    ...options?.mutation,
  })
}

export function usePublish<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { data: RoundPublishRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ data }) => publish(data),
    ...options?.mutation,
  })
}

export function useResume<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { roundId: string }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ roundId }) => resume(roundId),
    ...options?.mutation,
  })
}

export function usePause<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { roundId: string }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ roundId }) => pause(roundId),
    ...options?.mutation,
  })
}
