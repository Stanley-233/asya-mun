import { ApiError } from './errors'

const SUCCESS_CODE = 200

export interface ApiEnvelope<T> {
  code?: number
  message?: string
  data?: T
}

function normalizePayload(payload: unknown) {
  if (typeof payload !== 'string') {
    return payload
  }

  try {
    return JSON.parse(payload) as unknown
  } catch {
    return payload
  }
}

export function unwrapApiResult<T>(payload: unknown): T {
  const normalized = normalizePayload(payload)

  if (!normalized || typeof normalized !== 'object' || !('code' in normalized)) {
    return normalized as T
  }

  const envelope = normalized as ApiEnvelope<T>
  const code = typeof envelope.code === 'number' ? envelope.code : undefined

  if (code !== undefined && code !== SUCCESS_CODE) {
    throw new ApiError(envelope.message || '请求失败', { code })
  }

  return envelope.data as T
}
