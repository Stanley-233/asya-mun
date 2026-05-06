import { useMutation, useQuery } from '@tanstack/react-query'
import {
  createConfig,
  createRecord,
  deleteRecord,
  listConfigs,
  listMyRecords,
  queryForManagement,
  updateConfig,
  updateRecord,
} from '../apis/delegate-attr.api'
import type {
  DelegateAttrColumnViewModel,
  DelegateAttrRecordRowViewModel,
  NormalizedPage,
} from '../apis/delegate-attr.api'
import type {
  DelegateAttrConfigCreateRequest,
  DelegateAttrConfigResponse,
  DelegateAttrConfigUpdateRequest,
  DelegateAttrManageQueryRequest,
  DelegateAttrRecordUpsertRequest,
  ListMyRecordsParams,
  QueryForManagementParams,
} from '../generated'
import type { MutationHookOptions, QueryHookOptions } from './shared'

export const delegateAttrKeys = {
  listConfigs: () => ['/api/delegate-attrs/configs'] as const,
  listMyRecords: (params?: ListMyRecordsParams) => ['/api/delegate-attrs/my-records', params] as const,
}

export const getListConfigsQueryKey = delegateAttrKeys.listConfigs
export const getListMyRecordsQueryKey = (params?: ListMyRecordsParams) =>
  delegateAttrKeys.listMyRecords(params)

export function useListConfigs<TData = DelegateAttrConfigResponse[], TError = unknown>(
  options?: QueryHookOptions<DelegateAttrConfigResponse[], TData, TError>,
) {
  return useQuery({
    queryKey: delegateAttrKeys.listConfigs(),
    queryFn: listConfigs,
    ...options?.query,
  })
}

export function useListMyRecords<TData = NormalizedPage<DelegateAttrRecordRowViewModel>, TError = unknown>(
  params: ListMyRecordsParams,
  options?: QueryHookOptions<NormalizedPage<DelegateAttrRecordRowViewModel>, TData, TError>,
) {
  return useQuery({
    queryKey: delegateAttrKeys.listMyRecords(params),
    queryFn: () => listMyRecords(params),
    ...options?.query,
  })
}

export function useQueryForManagement<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<
    { configs: DelegateAttrColumnViewModel[]; records: NormalizedPage<DelegateAttrRecordRowViewModel> },
    { data: DelegateAttrManageQueryRequest; params: QueryForManagementParams },
    TError,
    TContext
  >,
) {
  return useMutation({
    mutationFn: ({ data, params }) => queryForManagement(data, params),
    ...options?.mutation,
  })
}

export function useCreateRecord<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { delegateId: string; data: DelegateAttrRecordUpsertRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ delegateId, data }) => createRecord(delegateId, data),
    ...options?.mutation,
  })
}

export function useUpdateRecord<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<
    void,
    { delegateId: string; recordId: string; data: DelegateAttrRecordUpsertRequest },
    TError,
    TContext
  >,
) {
  return useMutation({
    mutationFn: ({ delegateId, recordId, data }) => updateRecord(delegateId, recordId, data),
    ...options?.mutation,
  })
}

export function useDeleteRecord<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { delegateId: string; recordId: string }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ delegateId, recordId }) => deleteRecord(delegateId, recordId),
    ...options?.mutation,
  })
}

export function useCreateConfig<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { data: DelegateAttrConfigCreateRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ data }) => createConfig(data),
    ...options?.mutation,
  })
}

export function useUpdateConfig<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { configId: string; data: DelegateAttrConfigUpdateRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ configId, data }) => updateConfig(configId, data),
    ...options?.mutation,
  })
}
