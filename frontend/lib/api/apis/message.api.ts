import { apiRequester } from '../client'
import { normalizePagePayload, type NormalizedPage } from '../core/page'
import { withQuery } from '../core/query'
import type {
  GetAllParams,
  GetAllSecretInConferenceParams,
  GetSecretMessagesParams,
  MessageCreateRequest,
  MessageReceiverVisibilityResponse,
  MessageResponse,
  MessageUpdateRequest,
} from '../generated'

export async function getOne(uuid: string) {
  return apiRequester.requestProtected<MessageResponse>({
    path: `/api/messages/${uuid}`,
    method: 'GET',
  })
}

export async function update1(uuid: string, data: MessageUpdateRequest) {
  return apiRequester.requestProtected<void>({
    path: `/api/messages/${uuid}`,
    method: 'PUT',
    body: data,
  })
}

export async function _delete(uuid: string) {
  return apiRequester.requestProtected<void>({
    path: `/api/messages/${uuid}`,
    method: 'DELETE',
  })
}

export async function getAll(params: GetAllParams) {
  const response = await apiRequester.requestProtected<unknown>({
    path: withQuery('/api/messages', params as Record<string, unknown>),
    method: 'GET',
  })
  return normalizePagePayload<MessageResponse>(response)
}

export async function create1(data: MessageCreateRequest) {
  return apiRequester.requestProtected<void>({
    path: '/api/messages',
    method: 'POST',
    body: data,
  })
}

export async function getReceivers(uuid: string) {
  return apiRequester.requestProtected<MessageReceiverVisibilityResponse[]>({
    path: `/api/messages/${uuid}/receivers`,
    method: 'GET',
  })
}

export async function getSecretMessages(params: GetSecretMessagesParams) {
  const response = await apiRequester.requestProtected<unknown>({
    path: withQuery('/api/messages/secret', params as Record<string, unknown>),
    method: 'GET',
  })
  return normalizePagePayload<MessageResponse>(response)
}

export async function getAllSecretInConference(params: GetAllSecretInConferenceParams) {
  const response = await apiRequester.requestProtected<unknown>({
    path: withQuery('/api/messages/secret/conference', params as Record<string, unknown>),
    method: 'GET',
  })
  return normalizePagePayload<MessageResponse>(response)
}

export type { NormalizedPage }
