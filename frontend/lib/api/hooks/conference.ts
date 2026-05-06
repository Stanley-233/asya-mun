import { useMutation, useQuery } from '@tanstack/react-query'
import { assignUser, create, getMine, getUsers, listAll2, update2 } from '../apis/conference.api'
import type {
  ConferenceAssignRequest,
  ConferenceRequest,
  ConferenceResponse,
  UserInfoResponse,
} from '../generated'
import type { MutationHookOptions, QueryHookOptions } from './shared'

export const conferenceKeys = {
  mine: () => ['/api/conference'] as const,
  users: () => ['/api/conference/users'] as const,
  listAll: () => ['/api/conference/all'] as const,
}

export const getGetMineQueryKey = conferenceKeys.mine
export const getGetUsersQueryKey = conferenceKeys.users
export const getListAll2QueryKey = conferenceKeys.listAll

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
