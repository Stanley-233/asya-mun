import { apiRequester } from '../client'
import { normalizePagePayload, type NormalizedPage } from '../core/page'
import { withQuery } from '../core/query'
import type {
  ConferenceAssignRequest,
  ConferenceRequest,
  ConferenceResponse,
  Pageable,
  UserInfoResponse,
} from '../generated'

export async function getMine() {
  return apiRequester.requestProtected<ConferenceResponse>({
    path: '/api/conference',
    method: 'GET',
  })
}

export async function update2(data: ConferenceRequest) {
  return apiRequester.requestProtected<void>({
    path: '/api/conference',
    method: 'PUT',
    body: data,
  })
}

export async function updateConferenceByUuid(uuid: string, data: ConferenceRequest) {
  return apiRequester.requestProtected<void>({
    path: `/api/conference/${uuid}`,
    method: 'PUT',
    body: data,
  })
}

export async function create(data: ConferenceRequest) {
  return apiRequester.requestProtected<void>({
    path: '/api/conference',
    method: 'POST',
    body: data,
  })
}

export async function assignUser(data: ConferenceAssignRequest) {
  return apiRequester.requestProtected<void>({
    path: '/api/conference/assign',
    method: 'POST',
    body: data,
  })
}

export async function getUsers() {
  return apiRequester.requestProtected<UserInfoResponse[]>({
    path: '/api/conference/users',
    method: 'GET',
  })
}

export async function listAll2() {
  return apiRequester.requestProtected<ConferenceResponse[]>({
    path: '/api/conference/all',
    method: 'GET',
  })
}

export interface ListConferenceParams {
  pageable: Pageable
}

export async function listConferencePage(params: ListConferenceParams) {
  const response = await apiRequester.requestProtected<unknown>({
    path: withQuery('/api/conference/page', { ...params }),
    method: 'GET',
  })
  return normalizePagePayload<ConferenceResponse>(response)
}

export type { NormalizedPage }
