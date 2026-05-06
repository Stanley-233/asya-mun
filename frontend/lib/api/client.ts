import Axios from 'axios'
import { buildLoginRedirect } from '@/lib/auth/return-to'
import { unwrapApiResult } from './core/result'
import { createApiRequester } from './core/requester'
import { createTransport, type JsonRequester } from './core/transport'

export const AXIOS_INSTANCE = Axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '',
})

AXIOS_INSTANCE.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
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
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      window.location.href = buildLoginRedirect()
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
