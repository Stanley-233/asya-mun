import { unwrapApiResult } from './result'
import type { JsonResponse, Transport, TransportRequest } from './transport'

export interface ApiRequester {
  requestPublic<T>(request: TransportRequest): Promise<T>
  requestProtected<T>(request: TransportRequest): Promise<T>
  requestPublicRaw<T>(request: TransportRequest): Promise<JsonResponse<T>>
  requestProtectedRaw<T>(request: TransportRequest): Promise<JsonResponse<T>>
}

export interface CreateApiRequesterOptions {
  transport: Transport
}

function withJsonHeaders(request: TransportRequest): TransportRequest {
  if (request.body === undefined || request.body instanceof FormData) {
    return request
  }

  return {
    ...request,
    headers: {
      'Content-Type': 'application/json',
      ...request.headers,
    },
  }
}

export function createApiRequester({
  transport,
}: CreateApiRequesterOptions): ApiRequester {
  return {
    async requestPublic<T>(request: TransportRequest) {
      const response = await transport.send<unknown>(withJsonHeaders(request))
      return unwrapApiResult<T>(response.data)
    },
    async requestProtected<T>(request: TransportRequest) {
      const response = await transport.send<unknown>(withJsonHeaders(request))
      return unwrapApiResult<T>(response.data)
    },
    async requestPublicRaw<T>(request: TransportRequest) {
      return transport.send<T>(withJsonHeaders(request))
    },
    async requestProtectedRaw<T>(request: TransportRequest) {
      return transport.send<T>(withJsonHeaders(request))
    },
  }
}
