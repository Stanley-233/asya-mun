import { apiRequester } from '../client'
import { normalizePagePayload, type NormalizedPage } from '../core/page'
import { withQuery } from '../core/query'
import type {
  BatchRegisterRequest,
  Pageable,
  SetRegistrationSwitchParams,
  ResetPasswordBody,
  TokenRefreshResponse,
  UserInfoResponse,
  UserInfoResponseRole,
  UserRegistrationRequest,
  UserUpdateRequest,
} from '../generated'

export interface ListUsersParams {
  name?: string
  displayName?: string
  conferenceUuid?: string
  role?: UserInfoResponseRole
  pageable: Pageable
}

export async function updateUser(uuid: string, data: UserUpdateRequest) {
  return apiRequester.requestProtected<void>({
    path: `/api/users/user/${uuid}`,
    method: 'PUT',
    body: data,
  })
}

export async function resetPassword(uuid: string, data: ResetPasswordBody) {
  return apiRequester.requestProtected<void>({
    path: `/api/users/${uuid}/password-reset`,
    method: 'POST',
    body: data,
  })
}

export async function getRegistrationSwitch() {
  return apiRequester.requestPublic<boolean>({
    path: '/api/users/registration-switch',
    method: 'GET',
  })
}

export async function setRegistrationSwitch(params: SetRegistrationSwitchParams) {
  return apiRequester.requestProtected<void>({
    path: withQuery('/api/users/registration-switch', params as Record<string, unknown>),
    method: 'POST',
  })
}

export async function register(data: UserRegistrationRequest) {
  return apiRequester.requestPublic<{ token?: string; [key: string]: unknown }>({
    path: '/api/users/register',
    method: 'POST',
    body: data,
  })
}

export async function login(data: UserRegistrationRequest) {
  return apiRequester.requestPublic<{ token?: string; [key: string]: unknown }>({
    path: '/api/users/login',
    method: 'POST',
    body: data,
  })
}

export async function refreshSession() {
  return apiRequester.requestPublic<TokenRefreshResponse>({
    path: '/api/users/refresh',
    method: 'POST',
  })
}

export async function logoutSession() {
  return apiRequester.requestProtected<void>({
    path: '/api/users/logout',
    method: 'POST',
  })
}

export async function batchRegister(data: BatchRegisterRequest) {
  return apiRequester.requestProtected<void>({
    path: '/api/users/batch',
    method: 'POST',
    body: data,
  })
}

export async function listAll1(params: ListUsersParams) {
  const response = await apiRequester.requestProtected<unknown>({
    path: withQuery('/api/users', { ...params }),
    method: 'GET',
  })
  return normalizePagePayload<UserInfoResponse>(response)
}

export async function getCurrentUser() {
  return apiRequester.requestProtected<UserInfoResponse>({
    path: '/api/users/user',
    method: 'GET',
  })
}

export async function deleteUser(uuid: string) {
  return apiRequester.requestProtected<void>({
    path: `/api/users/${uuid}`,
    method: 'DELETE',
  })
}

export type { NormalizedPage }
