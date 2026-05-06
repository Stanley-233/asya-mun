import { useMutation, useQuery } from '@tanstack/react-query'
import {
  _delete,
  create1,
  getAll,
  getAllSecretInConference,
  getOne,
  getReceivers,
  getSecretMessages,
  update1,
} from '../apis/message.api'
import type { NormalizedPage } from '../core/page'
import type {
  GetAllParams,
  GetAllSecretInConferenceParams,
  GetSecretMessagesParams,
  MessageCreateRequest,
  MessageReceiverVisibilityResponse,
  MessageResponse,
  MessageUpdateRequest,
} from '../generated'
import type { MutationHookOptions, QueryHookOptions } from './shared'

export const messageKeys = {
  detail: (uuid: string) => ['/api/messages', uuid] as const,
  list: (params?: GetAllParams) => ['/api/messages', params] as const,
  receivers: (uuid: string) => ['/api/messages', uuid, 'receivers'] as const,
  secret: (params?: GetSecretMessagesParams) => ['/api/messages/secret', params] as const,
  secretConference: (params?: GetAllSecretInConferenceParams) =>
    ['/api/messages/secret/conference', params] as const,
}

export const getGetOneQueryKey = (uuid: string) => messageKeys.detail(uuid)
export const getGetAllQueryKey = (params?: GetAllParams) => messageKeys.list(params)
export const getGetReceiversQueryKey = (uuid: string) => messageKeys.receivers(uuid)
export const getGetSecretMessagesQueryKey = (params?: GetSecretMessagesParams) => messageKeys.secret(params)
export const getGetAllSecretInConferenceQueryKey = (params?: GetAllSecretInConferenceParams) =>
  messageKeys.secretConference(params)

export function useGetOne<TData = MessageResponse, TError = unknown>(
  uuid: string,
  options?: QueryHookOptions<MessageResponse, TData, TError>,
) {
  return useQuery({
    queryKey: messageKeys.detail(uuid),
    queryFn: () => getOne(uuid),
    enabled: !!uuid,
    ...options?.query,
  })
}

export function useGetAll<TData = NormalizedPage<MessageResponse>, TError = unknown>(
  params: GetAllParams,
  options?: QueryHookOptions<NormalizedPage<MessageResponse>, TData, TError>,
) {
  return useQuery({
    queryKey: messageKeys.list(params),
    queryFn: () => getAll(params),
    ...options?.query,
  })
}

export function useGetReceivers<TData = MessageReceiverVisibilityResponse[], TError = unknown>(
  uuid: string,
  options?: QueryHookOptions<MessageReceiverVisibilityResponse[], TData, TError>,
) {
  return useQuery({
    queryKey: messageKeys.receivers(uuid),
    queryFn: () => getReceivers(uuid),
    enabled: !!uuid,
    ...options?.query,
  })
}

export function useGetSecretMessages<TData = NormalizedPage<MessageResponse>, TError = unknown>(
  params: GetSecretMessagesParams,
  options?: QueryHookOptions<NormalizedPage<MessageResponse>, TData, TError>,
) {
  return useQuery({
    queryKey: messageKeys.secret(params),
    queryFn: () => getSecretMessages(params),
    ...options?.query,
  })
}

export function useGetAllSecretInConference<TData = NormalizedPage<MessageResponse>, TError = unknown>(
  params: GetAllSecretInConferenceParams,
  options?: QueryHookOptions<NormalizedPage<MessageResponse>, TData, TError>,
) {
  return useQuery({
    queryKey: messageKeys.secretConference(params),
    queryFn: () => getAllSecretInConference(params),
    ...options?.query,
  })
}

export function useCreate1<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { data: MessageCreateRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ data }) => create1(data),
    ...options?.mutation,
  })
}

export function useUpdate1<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { uuid: string; data: MessageUpdateRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ uuid, data }) => update1(uuid, data),
    ...options?.mutation,
  })
}

export function useDelete<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { uuid: string }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ uuid }) => _delete(uuid),
    ...options?.mutation,
  })
}
