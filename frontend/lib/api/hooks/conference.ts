import { useMutation, useQuery } from '@tanstack/react-query'
import { assignUser, create, getMine, getUsers, listAll2, listConferencePage, update2, updateConferenceByUuid } from '../apis/conference.api'
import type {
  ConferenceAssignRequest,
  ConferenceRequest,
  ConferenceResponse,
  UserInfoResponse,
} from '../generated'
import type { ListConferenceParams, NormalizedPage } from '../apis/conference.api'
import type { MutationHookOptions, QueryHookOptions } from './shared'

export const conferenceKeys = {
  mine: () => ['/api/conference'] as const,
  users: () => ['/api/conference/users'] as const,
  listAll: () => ['/api/conference/all'] as const,
  page: (params: ListConferenceParams) => ['/api/conference/page', params] as const,
}

export const getGetMineQueryKey = conferenceKeys.mine
export const getGetUsersQueryKey = conferenceKeys.users
export const getListAll2QueryKey = conferenceKeys.listAll
export const getListConferencePageQueryKey = conferenceKeys.page

export function useGetMine<TData = ConferenceResponse, TError = unknown>(
  options?: QueryHookOptions<ConferenceResponse, TData, TError>,
) {
  return useQuery({
    queryKey: conferenceKeys.mine(),
    queryFn: getMine,
    ...options?.query,
  })
}

export function useGetUsers<TData = UserInfoResponse[], TError = unknown>(
  options?: QueryHookOptions<UserInfoResponse[], TData, TError>,
) {
  return useQuery({
    queryKey: conferenceKeys.users(),
    queryFn: getUsers,
    ...options?.query,
  })
}

export function useListAll2<TData = ConferenceResponse[], TError = unknown>(
  options?: QueryHookOptions<ConferenceResponse[], TData, TError>,
) {
  return useQuery({
    queryKey: conferenceKeys.listAll(),
    queryFn: listAll2,
    ...options?.query,
  })
}

export function useListConferencePage<TData = NormalizedPage<ConferenceResponse>, TError = unknown>(
  params: ListConferenceParams,
  options?: QueryHookOptions<NormalizedPage<ConferenceResponse>, TData, TError>,
) {
  return useQuery({
    queryKey: conferenceKeys.page(params),
    queryFn: () => listConferencePage(params),
    ...options?.query,
  })
}

export function useUpdate2<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { data: ConferenceRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ data }) => update2(data),
    ...options?.mutation,
  })
}

export function useCreate<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { data: ConferenceRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ data }) => create(data),
    ...options?.mutation,
  })
}

export function useAssignUser<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { data: ConferenceAssignRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ data }) => assignUser(data),
    ...options?.mutation,
  })
}

export function useUpdateConferenceByUuid<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { uuid: string; data: ConferenceRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ uuid, data }) => updateConferenceByUuid(uuid, data),
    ...options?.mutation,
  })
}
