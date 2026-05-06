import { apiRequester } from '../client'
import type {
  RoundPublishRequest,
  RoundResponse,
  RoundSetCurrentRequest,
  RoundSetNextRequest,
  RoundSetRemainingRequest,
  RoundUpdateRequest,
} from '../generated'

export async function detail(roundId: string) {
  return apiRequester.requestProtected<RoundResponse>({
    path: `/api/round/${roundId}`,
    method: 'GET',
  })
}

export async function update(roundId: string, data: RoundUpdateRequest) {
  return apiRequester.requestProtected<void>({
    path: `/api/round/${roundId}`,
    method: 'PUT',
    body: data,
  })
}

export async function updateRemaining(roundId: string, data: RoundSetRemainingRequest) {
  return apiRequester.requestProtected<void>({
    path: `/api/round/${roundId}/remaining`,
    method: 'PUT',
    body: data,
  })
}

export async function setNext(roundId: string, data: RoundSetNextRequest) {
  return apiRequester.requestProtected<void>({
    path: `/api/round/${roundId}/next`,
    method: 'PUT',
    body: data,
  })
}

export async function current() {
  return apiRequester.requestProtected<RoundResponse>({
    path: '/api/round/current',
    method: 'GET',
  })
}

export async function updateCurrent(data: RoundSetCurrentRequest) {
  return apiRequester.requestProtected<void>({
    path: '/api/round/current',
    method: 'PUT',
    body: data,
  })
}

export async function list() {
  return apiRequester.requestProtected<RoundResponse[]>({
    path: '/api/round',
    method: 'GET',
  })
}

export async function publish(data: RoundPublishRequest) {
  return apiRequester.requestProtected<void>({
    path: '/api/round',
    method: 'POST',
    body: data,
  })
}

export async function resume(roundId: string) {
  return apiRequester.requestProtected<void>({
    path: `/api/round/${roundId}/resume`,
    method: 'POST',
  })
}

export async function pause(roundId: string) {
  return apiRequester.requestProtected<void>({
    path: `/api/round/${roundId}/pause`,
    method: 'POST',
  })
}
