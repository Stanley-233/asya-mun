import { apiRequester } from '../client'
import type {
  CurrentTimeResponse,
  TimeAnchorResponse,
  TimeJumpRequest,
  TimeUpdateRequest,
} from '../generated'

export async function update3(data: TimeUpdateRequest) {
  return apiRequester.requestProtected<void>({
    path: '/api/time/update',
    method: 'POST',
    body: data,
  })
}

export async function jump(data: TimeJumpRequest) {
  return apiRequester.requestProtected<void>({
    path: '/api/time/jump',
    method: 'POST',
    body: data,
  })
}

export async function getAll1() {
  return apiRequester.requestProtected<TimeAnchorResponse[]>({
    path: '/api/time',
    method: 'GET',
  })
}

export async function getLatest() {
  return apiRequester.requestProtected<TimeAnchorResponse>({
    path: '/api/time/latest',
    method: 'GET',
  })
}

export async function getCurrent() {
  return apiRequester.requestProtected<CurrentTimeResponse>({
    path: '/api/time/current',
    method: 'GET',
  })
}
