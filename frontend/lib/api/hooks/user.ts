import { useMutation, useQuery } from '@tanstack/react-query'
import {
  batchRegister,
  batchRegisterFull,
  login,
  deleteUser,
  getCurrentUser,
  getRegistrationSwitch,
  listAll1,
  register,
  logoutSession,
  resetPassword,
  refreshSession,
  setRegistrationSwitch,
  updateUser,
  type ListUsersParams,
  type NormalizedPage,
} from '../apis/user.api'
import type {
  BatchRegisterRequest,
  BatchRegisterFullRequest,
  ResetPasswordBody,
  SetRegistrationSwitchParams,
  UserInfoResponse,
  UserUpdateRequest,
} from '../generated'
import type { MutationHookOptions, QueryHookOptions } from './shared'

export const userKeys = {
  registrationSwitch: () => ['/api/users/registration-switch'] as const,
  listAll: (params: ListUsersParams) => ['/api/users', params] as const,
  current: () => ['/api/users/user'] as const,
}

export const getGetRegistrationSwitchQueryKey = userKeys.registrationSwitch
export const getListAll1QueryKey = userKeys.listAll
export const getGetCurrentUserQueryKey = userKeys.current

export function useGetRegistrationSwitch<TData = boolean, TError = unknown>(
  options?: QueryHookOptions<boolean, TData, TError>,
) {
  return useQuery({
    queryKey: userKeys.registrationSwitch(),
    queryFn: getRegistrationSwitch,
    ...options?.query,
  })
}

export function useListAll1<TData = NormalizedPage<UserInfoResponse>, TError = unknown>(
  params: ListUsersParams,
  options?: QueryHookOptions<NormalizedPage<UserInfoResponse>, TData, TError>,
) {
  return useQuery({
    queryKey: userKeys.listAll(params),
    queryFn: () => listAll1(params),
    ...options?.query,
  })
}

export function useGetCurrentUser<TData = UserInfoResponse, TError = unknown>(
  options?: QueryHookOptions<UserInfoResponse, TData, TError>,
) {
  return useQuery({
    queryKey: userKeys.current(),
    queryFn: getCurrentUser,
    ...options?.query,
  })
}

export function useUpdateUser<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { uuid: string; data: UserUpdateRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ uuid, data }) => updateUser(uuid, data),
    ...options?.mutation,
  })
}

export function useResetPassword<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { uuid: string; data: ResetPasswordBody }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ uuid, data }) => resetPassword(uuid, data),
    ...options?.mutation,
  })
}

export function useSetRegistrationSwitch<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { params: SetRegistrationSwitchParams }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ params }) => setRegistrationSwitch(params),
    ...options?.mutation,
  })
}

export function useBatchRegister<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { data: BatchRegisterRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ data }) => batchRegister(data),
    ...options?.mutation,
  })
}

export function useBatchRegisterFull<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { data: BatchRegisterFullRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ data }) => batchRegisterFull(data),
    ...options?.mutation,
  })
}

export function useDeleteUser<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { uuid: string }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ uuid }) => deleteUser(uuid),
    ...options?.mutation,
  })
}

export { login, logoutSession, refreshSession, register }
export type { ListUsersParams }
