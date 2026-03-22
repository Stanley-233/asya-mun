'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/contexts/auth-context'
import { useListConfigs, useListMyRecords } from '@/lib/api/endpoints/代表属性管理/代表属性管理'
import {
  formatDelegateAttrUpdatedAt,
  getDelegateAttrDisplayValue,
  parseDelegateAttrConfigs,
  parseDelegateAttrRecordPage,
} from '@/lib/delegate-attr/utils'

const PAGE_SIZE = 10

export default function StatusPage() {
  const router = useRouter()
  const { isLoading: authLoading, isAuthenticated, user } = useAuth()
  const [currentPage, setCurrentPage] = useState(0)

  const isDelegate = user?.role === 'DELEGATE'

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isDelegate)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, isDelegate, router])

  const {
    data: configsData,
    isLoading: configsLoading,
  } = useListConfigs({
    query: {
      enabled: isAuthenticated && isDelegate,
    },
  })

  const columns = useMemo(() => parseDelegateAttrConfigs(configsData), [configsData])

  const {
    data: myRecordsData,
    isLoading: recordsLoading,
    isFetching: recordsFetching,
  } = useListMyRecords(
    {
      pageable: {
        page: currentPage,
        size: PAGE_SIZE,
        sort: ['updatedAt,desc'],
      },
    },
    {
      query: {
        enabled: isAuthenticated && isDelegate && !configsLoading,
      },
    },
  )

  const parsedRecordPage = useMemo(() => parseDelegateAttrRecordPage(myRecordsData), [myRecordsData])
  const rows = parsedRecordPage.records.content
  const totalPages = parsedRecordPage.records.totalPages
  const isFirstPage = parsedRecordPage.records.isFirstPage || currentPage <= 0
  const isLastPage =
    parsedRecordPage.records.isLastPage || (totalPages > 0 ? currentPage >= totalPages - 1 : true)

  if (authLoading || configsLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-lg text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !isDelegate) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>状态</CardTitle>
            <CardDescription>按当前会议属性配置查看你的状态记录</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">更新时间</th>
                    {columns.map(column => (
                      <th key={column.key} className="px-3 py-2 text-left font-medium">
                        {column.label}
                        {!column.enabled ? <span className="ml-1 text-xs text-muted-foreground">(停用)</span> : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recordsLoading || recordsFetching ? (
                    <tr>
                      <td colSpan={Math.max(columns.length + 1, 1)} className="px-3 py-8 text-center text-muted-foreground">
                        加载中...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={Math.max(columns.length + 1, 1)} className="px-3 py-8 text-center text-muted-foreground">
                        暂无记录
                      </td>
                    </tr>
                  ) : (
                    rows.map(row => (
                      <tr key={row.recordId} className="border-t">
                        <td className="px-3 py-2">{formatDelegateAttrUpdatedAt(row.updatedAt)}</td>
                        {columns.map(column => (
                          <td key={`${row.recordId}-${column.key}`} className="px-3 py-2">
                            {getDelegateAttrDisplayValue(row.valuesMap[column.key])}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t pt-4">
                <div className="text-sm text-muted-foreground">
                  第 {currentPage + 1} 页，共 {totalPages} 页
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={isFirstPage}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(Math.max(totalPages - 1, 0), prev + 1))}
                    disabled={isLastPage}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
