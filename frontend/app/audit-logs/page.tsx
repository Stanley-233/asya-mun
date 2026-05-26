'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/lib/contexts/auth-context'
import { buildLoginRedirect } from '@/lib/auth/return-to'
import { useListAuditLogs } from '@/lib/api/hooks/audit-log'
import type { ListAuditLogsParams } from '@/lib/api/generated'

const PAGE_SIZE = 20

const ACTION_TYPE_LABELS: Record<string, string> = {
  USER_REGISTER: '用户注册',
  USER_LOGIN: '用户登录',
  USER_BATCH_REGISTER: '批量注册',
  USER_UPDATE: '更新用户',
  USER_DELETE: '删除用户',
  USER_PASSWORD_RESET: '重置密码',
  USER_REGISTRATION_SWITCH: '注册开关',
  MESSAGE_CREATE: '创建消息',
  MESSAGE_UPDATE: '更新消息',
  MESSAGE_DELETE: '删除消息',
  ATTACHMENT_UPLOAD: '上传附件',
  ATTACHMENT_DELETE: '删除附件',
  ANNOUNCEMENT_IMAGE_UPDATE: '更新公告图',
  CONFERENCE_CREATE: '创建会议',
  CONFERENCE_UPDATE: '更新会议',
  CONFERENCE_ASSIGN_USER: '分配用户',
  USER_GROUP_CREATE: '创建用户组',
  USER_GROUP_UPDATE: '更新用户组',
  USER_GROUP_DELETE: '删除用户组',
  USER_GROUP_MEMBERS_UPDATE: '更新组成员',
  USER_GROUP_MEMBER_REMOVE: '移除组成员',
  TIMELINE_UPDATE: '更新时间线',
  TIMELINE_JUMP: '时间线跳转',
  ROUND_PUBLISH: '发布回合',
  ROUND_PAUSE: '暂停回合',
  ROUND_RESUME: '恢复回合',
  ROUND_SET_NEXT: '设置下一回合',
  ROUND_UPDATE: '更新回合',
  ROUND_SET_CURRENT: '设置当前回合',
  ROUND_SET_REMAINING: '设置剩余时间',
  ROUND_AUTO_ADVANCE: '自动推进回合',
  INSTRUCTION_CREATE: '创建指令',
  INSTRUCTION_REVIEW: '审核指令',
  INSTRUCTION_SUBMISSION_SWITCH: '指令提交开关',
  DELEGATE_ATTR_CONFIG_CREATE: '创建属性配置',
  DELEGATE_ATTR_CONFIG_UPDATE: '更新属性配置',
  DELEGATE_ATTR_RECORD_CREATE: '创建属性记录',
  DELEGATE_ATTR_RECORD_UPDATE: '更新属性记录',
  DELEGATE_ATTR_RECORD_DELETE: '删除属性记录',
  TEST_DATA_BOOTSTRAP: '初始化测试数据',
}

const ALL_FILTER_VALUE = '__ALL__'

type FilterFormValue = {
  actorName: string
  actionType: string
  success: string
  ip: string
  eventTimeFrom: string
  eventTimeTo: string
}

const EMPTY_FILTERS: FilterFormValue = {
  actorName: '',
  actionType: ALL_FILTER_VALUE,
  success: ALL_FILTER_VALUE,
  ip: '',
  eventTimeFrom: '',
  eventTimeTo: '',
}

function formatEventTime(iso: string) {
  try {
    const match = iso.match(/^(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
    if (!match) return iso
    const [, year, month, day, hour, minute, second = '00'] = match
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  } catch {
    return iso
  }
}

function toIsoOrUndefined(localDatetime: string): string | undefined {
  if (!localDatetime) return undefined
  const match = localDatetime.match(/^(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) return undefined
  const [, year, month, day, hour, minute] = match
  return `${year}-${month}-${day}T${hour}:${minute}:00`
}

export default function AuditLogsPage() {
  const router = useRouter()
  const { isLoading: authLoading, isSysAdmin, isAuthenticated } = useAuth()

  const [filters, setFilters] = useState<FilterFormValue>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<FilterFormValue>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)

  const params = useMemo<ListAuditLogsParams>(() => ({
    actorName: appliedFilters.actorName.trim() || undefined,
    actionType:
      appliedFilters.actionType !== ALL_FILTER_VALUE
        ? (appliedFilters.actionType as ListAuditLogsParams['actionType'])
        : undefined,
    success:
      appliedFilters.success === ALL_FILTER_VALUE
        ? undefined
        : appliedFilters.success === 'true',
    ip: appliedFilters.ip.trim() || undefined,
    eventTimeFrom: toIsoOrUndefined(appliedFilters.eventTimeFrom),
    eventTimeTo: toIsoOrUndefined(appliedFilters.eventTimeTo),
    pageable: {
      page,
      size: PAGE_SIZE,
      sort: ['eventTime,desc', 'id,desc'],
    },
  }), [appliedFilters, page])

  const { data, isLoading } = useListAuditLogs(params, {
    query: {
      enabled: isAuthenticated && isSysAdmin,
    },
  })

  const logs = data?.content ?? []
  const totalPages = data?.totalPages ?? 0
  const totalElements = data?.totalElements ?? 0

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.push(buildLoginRedirect())
      return
    }
    if (!isSysAdmin) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, isSysAdmin, router])

  const handleFilterChange = (field: keyof FilterFormValue, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const handleSearch = () => {
    setPage(0)
    setAppliedFilters(filters)
  }

  const handleReset = () => {
    setPage(0)
    setFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
  }

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-screen">
          <p className="text-lg text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isSysAdmin) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">系统日志</h1>
          <p className="text-muted-foreground mb-6">审计日志查询，仅系统管理员可访问</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>审计日志</CardTitle>
            <CardDescription>
              {isLoading ? '加载中...' : `共 ${totalElements} 条记录`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <div className="overflow-x-auto">
                <table className="min-w-[1000px] text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="py-3 px-3 text-left font-medium align-top">
                        <div className="min-w-40 space-y-2">
                          <div>时间</div>
                          <div className="flex items-center gap-1">
                            <Input
                              type="datetime-local"
                              value={filters.eventTimeFrom}
                              onChange={(e) => handleFilterChange('eventTimeFrom', e.target.value)}
                              className="h-8 bg-background text-xs"
                            />
                            <span className="shrink-0 text-xs text-muted-foreground">至</span>
                            <Input
                              type="datetime-local"
                              value={filters.eventTimeTo}
                              onChange={(e) => handleFilterChange('eventTimeTo', e.target.value)}
                              className="h-8 bg-background text-xs"
                            />
                          </div>
                        </div>
                      </th>
                      <th className="py-3 px-3 text-left font-medium align-top">
                        <div className="min-w-32 space-y-2">
                          <div>操作者</div>
                          <Input
                            value={filters.actorName}
                            onChange={(e) => handleFilterChange('actorName', e.target.value)}
                            placeholder="全部"
                            className="h-8 bg-background"
                          />
                        </div>
                      </th>
                      <th className="py-3 px-3 text-left font-medium align-top">
                        <div className="min-w-40 space-y-2">
                          <div>操作类型</div>
                          <Select
                            value={filters.actionType}
                            onValueChange={(value) => handleFilterChange('actionType', value)}
                          >
                            <SelectTrigger className="h-8 bg-background">
                              <SelectValue placeholder="全部类型" />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              <SelectItem value={ALL_FILTER_VALUE}>全部类型</SelectItem>
                              {Object.entries(ACTION_TYPE_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </th>
                      <th className="py-3 px-3 text-left font-medium align-top">
                        <div className="min-w-24 space-y-2">
                          <div>结果</div>
                          <Select
                            value={filters.success}
                            onValueChange={(value) => handleFilterChange('success', value)}
                          >
                            <SelectTrigger className="h-8 bg-background">
                              <SelectValue placeholder="全部" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={ALL_FILTER_VALUE}>全部</SelectItem>
                              <SelectItem value="true">成功</SelectItem>
                              <SelectItem value="false">失败</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </th>
                      <th className="py-3 px-3 text-left font-medium align-top">
                        <div className="min-w-28 space-y-2">
                          <div>IP</div>
                          <Input
                            value={filters.ip}
                            onChange={(e) => handleFilterChange('ip', e.target.value)}
                            placeholder="全部"
                            className="h-8 bg-background"
                          />
                        </div>
                      </th>
                      <th className="py-3 px-3 text-right font-medium align-top">
                        <div className="flex min-w-28 flex-col items-end gap-2">
                          <div>操作</div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleReset}>
                              重置
                            </Button>
                            <Button size="sm" onClick={handleSearch}>
                              查询
                            </Button>
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-muted-foreground">
                          加载中...
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-muted-foreground">
                          暂无日志数据
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="align-top">
                          <td className="py-3 px-3 whitespace-nowrap text-muted-foreground">
                            {formatEventTime(log.eventTime)}
                          </td>
                          <td className="py-3 px-3 font-medium">
                            {log.actorName || '—'}
                          </td>
                          <td className="py-3 px-3">
                            {ACTION_TYPE_LABELS[log.actionType] || log.actionType}
                          </td>
                          <td className="py-3 px-3">
                            {log.success ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                成功
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                失败
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-muted-foreground">
                            {log.actorIp || '—'}
                          </td>
                          <td className="py-3 px-3" />
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4">
              <p className="text-sm text-muted-foreground flex items-center h-9">
                第 {Math.min(page + 1, Math.max(totalPages, 1))} 页，共 {Math.max(totalPages, 1)} 页，共 {totalElements} 条记录
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage(prev => Math.max(prev - 1, 0))}
                  disabled={page === 0}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage(prev => Math.min(prev + 1, Math.max(totalPages - 1, 0)))}
                  disabled={totalPages <= 1 || page >= totalPages - 1}
                >
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
