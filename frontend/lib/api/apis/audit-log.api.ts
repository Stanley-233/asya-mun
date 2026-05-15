import { apiRequester } from '../client'
import { normalizePagePayload, type NormalizedPage } from '../core/page'
import { withQuery } from '../core/query'
import type {
  AuditLogResponse,
  ListAuditLogsParams,
} from '../generated'

export { listAuditLogs }

async function listAuditLogs(params: ListAuditLogsParams) {
  const response = await apiRequester.requestProtected<unknown>({
    path: withQuery('/api/audit-logs', { ...params }),
    method: 'GET',
  })
  return normalizePagePayload<AuditLogResponse>(response)
}

export async function getAuditLogById(id: number) {
  return apiRequester.requestProtected<AuditLogResponse>({
    path: `/api/audit-logs/${id}`,
    method: 'GET',
  })
}

export type { NormalizedPage, ListAuditLogsParams }
