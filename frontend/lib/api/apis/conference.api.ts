import { apiRequester } from '../client'
import type {
  ConferenceAssignRequest,
  ConferenceRequest,
  ConferenceResponse,
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
