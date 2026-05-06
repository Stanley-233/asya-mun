'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ImagePreviewDialog } from '@/components/message/image-preview-dialog'
import { useAuth } from '@/lib/contexts/auth-context'
import { buildLoginRedirect } from '@/lib/auth/return-to'
import { useGetAnnouncementImageInfo } from '@/lib/api/hooks/announcement'
import { downloadAnnouncementImage } from '@/lib/api/apis/announcement.api'
import { useListConfigs, useListMyRecords } from '@/lib/api/hooks/delegate-attr'
import {
  getAnnouncementFileDisplayName,
  parseAnnouncementImageMeta,
} from '@/lib/announcement-image/utils'
import {
  formatDelegateAttrUpdatedAt,
  getDelegateAttrDisplayValue,
  parseDelegateAttrConfigs,
  type DelegateAttrRecordRowViewModel,
} from '@/lib/delegate-attr/utils'

const PAGE_SIZE = 10

export default function StatusPage() {
  const router = useRouter()
  const { isLoading: authLoading, isAuthenticated, user } = useAuth()
  const [currentPage, setCurrentPage] = useState(0)
  const [announcementImageUrl, setAnnouncementImageUrl] = useState<string | null>(null)
  const [announcementImageLoading, setAnnouncementImageLoading] = useState(false)
  const [announcementImageError, setAnnouncementImageError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const isDelegate = user?.role === 'DELEGATE'

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.push(buildLoginRedirect())
      return
    }
    if (!isDelegate) {
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
  const visibleColumns = useMemo(() => columns.filter(column => column.visible), [columns])
  const {
    data: announcementInfoData,
    isLoading: announcementInfoLoading,
  } = useGetAnnouncementImageInfo({
    query: {
      enabled: isAuthenticated && isDelegate,
      retry: false,
    },
  })
  const announcementMeta = useMemo(
    () => parseAnnouncementImageMeta(announcementInfoData),
    [announcementInfoData],
  )
  const announcementFileName = useMemo(
    () => getAnnouncementFileDisplayName(announcementMeta),
    [announcementMeta],
  )

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

  const rows = myRecordsData?.content ?? []
  const totalPages = myRecordsData?.totalPages ?? 0
  const totalElements = myRecordsData?.totalElements ?? 0
  const isFirstPage = (myRecordsData?.isFirstPage ?? true) || currentPage <= 0
  const isLastPage =
    (myRecordsData?.isLastPage ?? true) || (totalPages > 0 ? currentPage >= totalPages - 1 : true)

  useEffect(() => {
    let active = true
    let currentObjectUrl: string | null = null

    const loadAnnouncementImage = async () => {
      if (!isAuthenticated || !isDelegate) return

      if (!announcementMeta?.uuid) {
        setAnnouncementImageLoading(false)
        setAnnouncementImageError(null)
        setAnnouncementImageUrl(prev => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
        return
      }

      setAnnouncementImageLoading(true)
      setAnnouncementImageError(null)

      try {
        const response = await downloadAnnouncementImage()
        if (!active) return
        currentObjectUrl = URL.createObjectURL(response.blob)
        setAnnouncementImageUrl(prev => {
          if (prev) URL.revokeObjectURL(prev)
          return currentObjectUrl
        })
      } catch (error) {
        if (!active) return
        setAnnouncementImageError('加载公告图片失败，请稍后重试')
        setAnnouncementImageUrl(prev => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
        console.error('Load announcement image failed:', error)
      } finally {
        if (active) {
          setAnnouncementImageLoading(false)
        }
      }
    }

    loadAnnouncementImage()

    return () => {
      active = false
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl)
      }
    }
  }, [announcementMeta?.uuid, isAuthenticated, isDelegate])

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
                    {visibleColumns.map(column => (
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
                      <td
                        colSpan={Math.max(visibleColumns.length + 1, 1)}
                        className="px-3 py-8 text-center text-muted-foreground"
                      >
                        加载中...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Math.max(visibleColumns.length + 1, 1)}
                        className="px-3 py-8 text-center text-muted-foreground"
                      >
                        暂无记录
                      </td>
                    </tr>
                  ) : (
                    rows.map((row: DelegateAttrRecordRowViewModel) => (
                      <tr key={row.recordId} className="border-t">
                        <td className="px-3 py-2">{formatDelegateAttrUpdatedAt(row.updatedAt)}</td>
                        {visibleColumns.map(column => (
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

            {totalElements > 0 && (
              <div className="flex items-center justify-between border-t pt-4">
                <div className="text-sm text-muted-foreground">
                  第 {currentPage + 1}/{totalPages} 页，共 {totalElements} 条记录
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

        <Card>
          <CardHeader>
            <CardTitle>公告图片</CardTitle>
            <CardDescription>查看当前会议公告图片</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {announcementInfoLoading || announcementImageLoading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : announcementImageError ? (
              <p className="text-sm text-destructive">{announcementImageError}</p>
            ) : !announcementMeta?.uuid || !announcementImageUrl ? (
              <p className="text-sm text-muted-foreground">暂无公告图片</p>
            ) : (
              <>
                <div className="overflow-hidden rounded-lg border bg-muted/20 p-3">
                  {/* Blob URL preview cannot be optimized by next/image. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={announcementImageUrl} alt={announcementFileName} className="mx-auto max-h-[380px] w-auto object-contain" />
                </div>
                <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span className="truncate">{announcementFileName}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                    查看大图
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <ImagePreviewDialog
        open={previewOpen}
        imageUrl={announcementImageUrl || undefined}
        fileName={announcementFileName}
        onOpenChange={setPreviewOpen}
      />
    </div>
  )
}
