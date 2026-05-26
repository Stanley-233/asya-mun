import Axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { buildLoginRedirect } from '@/lib/auth/return-to'
import {
  clearStoredAccessToken,
  getStoredAccessToken,
  setStoredAccessToken,
} from '@/lib/auth/token-storage'
import { unwrapApiResult } from './core/result'
import { createApiRequester } from './core/requester'
import { createTransport, type JsonRequester } from './core/transport'

type RetryableAxiosConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
  skipAuthRefresh?: boolean
}

interface TokenRefreshResponse {
  token: string
}

const REFRESH_PATH = '/api/users/refresh'
const LOGOUT_PATH = '/api/users/logout'
const LOGIN_PATH = '/api/users/login'
const REGISTER_PATH = '/api/users/register'
const TOKEN_INVALID_CODE = 4003

export const AXIOS_INSTANCE = Axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '',
  withCredentials: true,
})

let refreshPromise: Promise<string | null> | null = null

function isBrowser() {
  return typeof window !== 'undefined'
}

function isAuthLifecyclePath(url?: string) {
  return url === REFRESH_PATH || url === LOGOUT_PATH || url === LOGIN_PATH || url === REGISTER_PATH
}

function redirectToLogin() {
  if (!isBrowser()) return
  const destination = buildLoginRedirect()
  if (window.location.href.endsWith(destination)) return
  window.location.href = destination
}

export function clearClientAuth({ redirect = true }: { redirect?: boolean } = {}) {
  if (!isBrowser()) return
  clearStoredAccessToken()
  if (redirect) {
    redirectToLogin()
  }
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = AXIOS_INSTANCE.request({
      url: REFRESH_PATH,
      method: 'POST',
      skipAuthRefresh: true,
    } as RetryableAxiosConfig)
      .then((response) => {
        const payload = unwrapApiResult<TokenRefreshResponse>(response.data)
        if (!payload?.token) {
          throw new Error('刷新登录态失败：缺少 access token')
        }
        setStoredAccessToken(payload.token)
        return payload.token
      })
      .catch(() => {
        clearClientAuth()
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

function shouldAttemptTokenRefresh(config: RetryableAxiosConfig | undefined) {
  return isBrowser() && !!config && !config.skipAuthRefresh && !config._retry && !isAuthLifecyclePath(config.url)
}

async function retryWithFreshToken<T>(config: RetryableAxiosConfig, response: AxiosResponse<T>) {
  const nextToken = await refreshAccessToken()
  if (!nextToken) {
    return Promise.reject(response)
  }

  config._retry = true
  config.headers = config.headers ?? {}
  config.headers.Authorization = `Bearer ${nextToken}`

  return AXIOS_INSTANCE.request<T>(config)
}

AXIOS_INSTANCE.interceptors.request.use(
  (config) => {
    const token = getStoredAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    if (!config.headers['Content-Type'] && config.data && !(config.data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json'
    }

    return config
  },
  (error) => Promise.reject(error),
)

AXIOS_INSTANCE.interceptors.response.use(
  async (response) => {
    const config = response.config as RetryableAxiosConfig
    if (
      shouldAttemptTokenRefresh(config) &&
      response.data &&
      typeof response.data === 'object' &&
      'code' in response.data &&
      response.data.code === TOKEN_INVALID_CODE
    ) {
      return retryWithFreshToken(config, response)
    }

    return response
  },
  async (error: AxiosError) => {
    const config = error.config as RetryableAxiosConfig | undefined
    if (error.response?.status === 401 && shouldAttemptTokenRefresh(config)) {
      return retryWithFreshToken(config!, error.response)
    }

    if (error.response?.status === 401 && isBrowser() && !isAuthLifecyclePath(config?.url)) {
      clearClientAuth()
    }

    return Promise.reject(error)
  },
)

export const axiosJsonRequester: JsonRequester = async ({ url, method, headers, body }) => {
  const response = await AXIOS_INSTANCE.request({
    url,
    method,
    headers,
    data: body,
  })

  return {
    status: response.status,
    data: response.data,
    headers: response.headers,
  }
}

const transport = createTransport({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '',
  requester: axiosJsonRequester,
})

export const apiRequester = createApiRequester({
  transport,
})

export async function uploadMultipart<T>(
  url: string,
  formData: FormData,
  method: 'POST' | 'PUT' = 'POST',
) {
  const response = await AXIOS_INSTANCE.request({
    url,
    method,
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return unwrapApiResult<T>(response.data)
}

export async function downloadBlob(url: string) {
  const response = await AXIOS_INSTANCE.get<Blob>(url, {
    responseType: 'blob',
  })

  return {
    blob: response.data,
    headers: response.headers,
  }
}

type CustomInstanceConfig = Omit<RequestInit, 'body' | 'headers' | 'method'> & {
  body?: BodyInit | Record<string, unknown> | null
  data?: unknown
  headers?: HeadersInit | Record<string, string>
  method?: string
  params?: unknown
}

function normalizeAxiosHeaders(headers?: CustomInstanceConfig['headers']) {
  if (!headers) return undefined
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }
  return headers
}

export const customInstance = async <T>(url: string, config: CustomInstanceConfig = {}): Promise<T> => {
  const response = await AXIOS_INSTANCE.request({
    url,
    method: config.method,
    headers: normalizeAxiosHeaders(config.headers),
    params: config.params,
    data: config.body ?? config.data,
  })

  return {
    data: response.data,
    status: response.status,
    headers: response.headers,
  } as unknown as T
}
