import { apiRequester } from '../client'
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
  return apiRequester.requestProtected<unknown>({
    path: withQuery('/api/messages', params as Record<string, unknown>),
    method: 'GET',
  })
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
  return apiRequester.requestProtected<unknown>({
    path: withQuery('/api/messages/secret', params as Record<string, unknown>),
    method: 'GET',
  })
}

export async function getAllSecretInConference(params: GetAllSecretInConferenceParams) {
  return apiRequester.requestProtected<unknown>({
    path: withQuery('/api/messages/secret/conference', params as Record<string, unknown>),
    method: 'GET',
  })
}
