import { apiRequester } from '../client'
import { withQuery } from '../core/query'
import {
  normalizeDelegateAttrPage,
  parseDelegateAttrRecordPage,
  type DelegateAttrColumnViewModel,
  type DelegateAttrRecordRowViewModel,
  type NormalizedPage,
} from '@/lib/delegate-attr/utils'
import type {
  DelegateAttrConfigCreateRequest,
  DelegateAttrConfigResponse,
  DelegateAttrConfigUpdateRequest,
  DelegateAttrManageQueryRequest,
  DelegateAttrRecordPageResponse,
  DelegateAttrRecordUpsertRequest,
  ListMyRecordsParams,
  QueryForManagementParams,
} from '../generated'

export async function updateRecord(
  delegateId: string,
  recordId: string,
  data: DelegateAttrRecordUpsertRequest,
) {
  return apiRequester.requestProtected<void>({
    path: `/api/delegate-attrs/delegates/${delegateId}/records/${recordId}`,
    method: 'PUT',
    body: data,
  })
}

export async function deleteRecord(delegateId: string, recordId: string) {
  return apiRequester.requestProtected<void>({
    path: `/api/delegate-attrs/delegates/${delegateId}/records/${recordId}`,
    method: 'DELETE',
  })
}

export async function updateConfig(configId: string, data: DelegateAttrConfigUpdateRequest) {
  return apiRequester.requestProtected<void>({
    path: `/api/delegate-attrs/configs/${configId}`,
    method: 'PUT',
    body: data,
  })
}

export async function queryForManagement(
  data: DelegateAttrManageQueryRequest,
  params: QueryForManagementParams,
) {
  const response = await apiRequester.requestProtected<DelegateAttrRecordPageResponse>({
    path: withQuery('/api/delegate-attrs/manage/query', params as Record<string, unknown>),
    method: 'POST',
    body: data,
  })
  return parseDelegateAttrRecordPage(response)
}

export async function createRecord(delegateId: string, data: DelegateAttrRecordUpsertRequest) {
  return apiRequester.requestProtected<void>({
    path: `/api/delegate-attrs/delegates/${delegateId}/records`,
    method: 'POST',
    body: data,
  })
}

export async function listConfigs() {
  return apiRequester.requestProtected<DelegateAttrConfigResponse[]>({
    path: '/api/delegate-attrs/configs',
    method: 'GET',
  })
}

export async function createConfig(data: DelegateAttrConfigCreateRequest) {
  return apiRequester.requestProtected<void>({
    path: '/api/delegate-attrs/configs',
    method: 'POST',
    body: data,
  })
}

export async function listMyRecords(params: ListMyRecordsParams) {
  const response = await apiRequester.requestProtected<DelegateAttrRecordPageResponse>({
    path: withQuery('/api/delegate-attrs/my-records', params as Record<string, unknown>),
    method: 'GET',
  })
  return normalizeDelegateAttrPage(response as unknown as Record<string, unknown>)
}

export type {
  DelegateAttrColumnViewModel,
  DelegateAttrRecordRowViewModel,
  NormalizedPage,
}
