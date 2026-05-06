import { useMutation, useQuery } from '@tanstack/react-query'
import {
  createUserGroup,
  deleteUserGroup,
  getAllUserGroups,
  setGroupMembers,
  updateUserGroup,
} from '../apis/user-group.api'
import type {
  UserGroupMembersRequest,
  UserGroupRequest,
  UserGroupResponse,
} from '../generated'
import type { MutationHookOptions, QueryHookOptions } from './shared'

export const userGroupKeys = {
  all: () => ['/api/user-groups'] as const,
}

export const getGetAllUserGroupsQueryKey = userGroupKeys.all

export function useGetAllUserGroups<TData = UserGroupResponse[], TError = unknown>(
  options?: QueryHookOptions<UserGroupResponse[], TData, TError>,
) {
  return useQuery({
    queryKey: userGroupKeys.all(),
    queryFn: getAllUserGroups,
    ...options?.query,
  })
}

export function useCreateUserGroup<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { data: UserGroupRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ data }) => createUserGroup(data),
    ...options?.mutation,
  })
}

export function useUpdateUserGroup<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { id: number; data: UserGroupRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ id, data }) => updateUserGroup(id, data),
    ...options?.mutation,
  })
}

export function useDeleteUserGroup<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { id: number }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ id }) => deleteUserGroup(id),
    ...options?.mutation,
  })
}

export function useSetGroupMembers<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { id: number; data: UserGroupMembersRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ id, data }) => setGroupMembers(id, data),
    ...options?.mutation,
  })
}
