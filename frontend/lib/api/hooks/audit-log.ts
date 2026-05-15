import { useQuery } from '@tanstack/react-query'
import {
  getAuditLogById,
  listAuditLogs,
  type ListAuditLogsParams,
  type NormalizedPage,
} from '../apis/audit-log.api'
import type { AuditLogResponse } from '../generated'
import type { QueryHookOptions } from './shared'

export const auditLogKeys = {
  list: (params: ListAuditLogsParams) => ['/api/audit-logs', params] as const,
  detail: (id: number) => ['/api/audit-logs', id] as const,
}

export const getListAuditLogsQueryKey = auditLogKeys.list
export const getAuditLogDetailQueryKey = auditLogKeys.detail

export function useListAuditLogs<TData = NormalizedPage<AuditLogResponse>, TError = unknown>(
  params: ListAuditLogsParams,
  options?: QueryHookOptions<NormalizedPage<AuditLogResponse>, TData, TError>,
) {
  return useQuery({
    queryKey: auditLogKeys.list(params),
    queryFn: () => listAuditLogs(params),
    ...options?.query,
  })
}

export function useAuditLogDetail<TData = AuditLogResponse, TError = unknown>(
  id: number,
  options?: QueryHookOptions<AuditLogResponse, TData, TError>,
) {
  return useQuery({
    queryKey: auditLogKeys.detail(id),
    queryFn: () => getAuditLogById(id),
    enabled: !!id,
    ...options?.query,
  })
}
