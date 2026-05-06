export interface JsonResponse<T> {
  status: number
  data: T
  headers?: unknown
}

export interface JsonRequestConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
}

export type JsonRequester = <T>(config: JsonRequestConfig) => Promise<JsonResponse<T>>

export interface TransportRequest {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
}

export interface Transport {
  send<T>(request: TransportRequest): Promise<JsonResponse<T>>
}

export interface CreateTransportOptions {
  baseUrl: string
  requester: JsonRequester
}

export function createTransport({
  baseUrl,
  requester,
}: CreateTransportOptions): Transport {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')

  return {
    send<T>({ path, method, headers, body }: TransportRequest) {
      return requester<T>({
        url: `${normalizedBaseUrl}${path}`,
        method,
        headers,
        body,
      })
    },
  }
}
