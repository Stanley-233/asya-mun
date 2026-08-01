'use client'

import { type ComponentProps, useEffect, useMemo, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { useGetOne, useGetReceivers } from '@/lib/api/hooks/message'
import { download, getOne1 } from '@/lib/api/hooks/attachment'
import type {
  MessageReceiverVisibilityResponse,
  MessageResponse,
} from '@/lib/api/generated'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/lib/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { ImagePreviewDialog } from '@/components/message/image-preview-dialog'
import { Eye } from 'lucide-react'
import { toast } from 'react-toastify'
import { parseApiPayload } from '@/lib/api/response-utils'

interface MessageDetailDialogProps {
  messageUuid: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface AttachmentDisplayInfo {
  uuid: string
  fileName: string
  fileType: string
  fileSize?: number
}

const MSG_TYPE_LABELS = {
  EVENT: '事件',
  NEWS: '新闻',
  CRISIS: '危机',
  WAR_REPORT: '战报',
  SECRET_LETTER: '密函',
  MEMORANDUM: '备忘录',
  PROTOCOL: '议定书',
  AMENDMENT: '修正案',
  DECLARATION: '声明',
} as const

type MessageTypeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>

const MSG_TYPE_VARIANTS = {
  EVENT: 'default',
  NEWS: 'secondary',
  CRISIS: 'destructive',
  WAR_REPORT: 'default',
  SECRET_LETTER: 'secondary',
  MEMORANDUM: 'secondary',
  PROTOCOL: 'default',
  AMENDMENT: 'destructive',
  DECLARATION: 'outline',
} as const satisfies Record<NonNullable<MessageResponse['msgType']>, MessageTypeVariant>

// 格式化游戏时间为人类可读格式
function formatGameTime(isoString: string): string {
  if (!isoString) return '未知'

  try {
    const match = isoString.match(/^(-?\d+)-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
    if (!match) return isoString

    const [, yearStr, month, day, hour, minute, second] = match
    const year = parseInt(yearStr, 10)
    const era = year <= 0 ? 'BC ' : ''
    const displayYear = year <= 0 ? 1 - year : year

    return `${era}${displayYear}/${month}/${day} ${hour}:${minute}:${second}`
  } catch {
    return isoString
  }
}

function getSenderDisplayName(message: MessageResponse): string {
  return message.senderDisplayName?.trim() || message.senderName?.trim() || '未知'
}

function decodeMojibakeFilename(value: string): string {
  const raw = value.trim().replace(/^"|"$/g, '')
  try {
    const decoded = decodeURIComponent(raw)
    if (decoded) return decoded
  } catch {
    // ignore
  }

  try {
    const bytes = Uint8Array.from(Array.from(raw).map((char) => char.charCodeAt(0)))
    const utf8Text = new TextDecoder('utf-8').decode(bytes)
    if (utf8Text && !utf8Text.includes('�')) {
      return utf8Text
    }
  } catch {
    // ignore
  }

  return raw
}

function ensureExtension(filename: string, fileType?: string): string {
  if (!fileType) return filename
  if (filename.toLowerCase().endsWith(`.${fileType.toLowerCase()}`)) return filename
  return `${filename}.${fileType}`
}

function formatFileSize(size?: number): string {
  if (typeof size !== 'number' || Number.isNaN(size)) return '未知'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

function formatRealTime(isoString: string): string {
  if (!isoString) return '未知'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return isoString
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}/${m}/${day} ${h}:${min}:${s}`
}

function formatReadableAt(isoString: string): string {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return isoString || '未知'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}/${m}/${d} ${h}:${min}:${s}`
}

function getFilenameFromHeaders(headers: unknown, fallback: string): string {
  const getHeader = (name: string) => {
    if (!headers) return undefined
    if (typeof (headers as Headers).get === 'function') {
      return (headers as Headers).get(name) || undefined
    }
    const value = (headers as Record<string, unknown>)[name] ?? (headers as Record<string, unknown>)[name.toLowerCase()]
    return typeof value === 'string' ? value : undefined
  }

  const contentDisposition = getHeader('content-disposition')
  if (!contentDisposition) return fallback

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeMojibakeFilename(utf8Match[1])
  }

  const normalMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  if (normalMatch?.[1]) {
    return decodeMojibakeFilename(normalMatch[1])
  }

  return fallback
}

function isImageAttachment(fileType?: string, fileName?: string): boolean {
  const imageExtSet = new Set([
    'png',
    'jpg',
    'jpeg',
    'gif',
    'webp',
    'bmp',
    'svg',
    'avif',
    'heic',
    'heif',
  ])

  const normalizedFileType = (fileType || '').trim().toLowerCase().replace(/^\./, '')
  if (normalizedFileType && imageExtSet.has(normalizedFileType)) return true

  const normalizedFileName = (fileName || '').trim().toLowerCase()
  const extension = normalizedFileName.includes('.') ? normalizedFileName.split('.').pop() || '' : ''
  return imageExtSet.has(extension)
}

export function MessageDetailDialog({
  messageUuid,
  open,
  onOpenChange,
}: MessageDetailDialogProps) {
  const { canManageConference } = useAuth()
  const [downloadingUuid, setDownloadingUuid] = useState<string | null>(null)
  const [confirmDownloadUuid, setConfirmDownloadUuid] = useState<string | null>(null)
  const [previewingUuid, setPreviewingUuid] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<{ uuid: string; url: string; fileName: string } | null>(null)
  const [attachmentInfoMap, setAttachmentInfoMap] = useState<Record<string, AttachmentDisplayInfo>>({})
  const [isLoadingAttachmentInfo, setIsLoadingAttachmentInfo] = useState(false)
  const { data, isLoading, error } = useGetOne(messageUuid || '', {
    query: {
      enabled: !!messageUuid && open,
    },
  })
  const { data: receiversData } = useGetReceivers(messageUuid || '', {
    query: {
      enabled: !!messageUuid && open && canManageConference,
    },
  })

  const message = parseApiPayload<MessageResponse>(data)
  const receiverVisibilityList = parseApiPayload<MessageReceiverVisibilityResponse[]>(receiversData) || []

  const attachmentUuids = useMemo(() => message?.attachmentUuids || [], [message?.attachmentUuids])

  const receiverStatusList = receiverVisibilityList.map((receiver) => {
    const readableAtTs = new Date(receiver.readableAt).getTime()
    const isReadable = Number.isFinite(readableAtTs) ? readableAtTs <= Date.now() : false
    return {
      ...receiver,
      isReadable,
    }
  })

  const inlineAttachmentInfos = useMemo(() => {
    if (!message) return []

    const raw = (message as MessageResponse & {
      attachmentInfos?: Array<{
        uuid?: string
        fileName?: string
        fileType?: string
        fileSize?: number
      }>
      attachments?: Array<{
        uuid?: string
        fileName?: string
        fileType?: string
        fileSize?: number
      }>
    })

    const list = raw.attachmentInfos || raw.attachments || []
    return list
      .filter((item) => !!item?.uuid)
      .map((item) => ({
        uuid: item.uuid!,
        fileName: item.fileName || item.uuid!,
        fileType: item.fileType || '',
        fileSize: item.fileSize,
      }))
  }, [message])

  useEffect(() => {
    if (!open || !message) return

    const baseMap = inlineAttachmentInfos.reduce<Record<string, AttachmentDisplayInfo>>((acc, item) => {
      acc[item.uuid] = item
      return acc
    }, {})

    if (Object.keys(baseMap).length > 0) {
      setAttachmentInfoMap(baseMap)
    } else {
      setAttachmentInfoMap({})
    }

    const missingUuids = attachmentUuids.filter((uuid) => !baseMap[uuid])
    if (missingUuids.length === 0) return

    let cancelled = false

    const fetchAttachmentInfos = async () => {
      setIsLoadingAttachmentInfo(true)
      try {
        const results = await Promise.allSettled(
          missingUuids.map(async (uuid) => {
            const item = await getOne1(uuid)

            if (!item?.uuid) return null

            return {
              uuid: item.uuid,
              fileName: item.fileName || item.uuid,
              fileType: item.fileType || '',
              fileSize: item.fileSize,
            } as AttachmentDisplayInfo
          })
        )

        if (cancelled) return

        const filtered = results.reduce((acc, result) => {
          if (result.status !== 'fulfilled' || !result.value) return acc
          acc[result.value.uuid] = result.value
          return acc
        }, {} as Record<string, AttachmentDisplayInfo>)

        if (Object.keys(filtered).length > 0) {
          setAttachmentInfoMap((prev) => ({ ...prev, ...filtered }))
        }
      } catch (err) {
        console.warn('Failed to fetch attachment metadata:', err)
      } finally {
        if (!cancelled) {
          setIsLoadingAttachmentInfo(false)
        }
      }
    }

    fetchAttachmentInfos()

    return () => {
      cancelled = true
    }
  }, [open, message, inlineAttachmentInfos, attachmentUuids])

  const handleDownloadAttachment = async (attachmentUuid: string) => {
    setDownloadingUuid(attachmentUuid)
    try {
      const attachmentInfo = attachmentInfoMap[attachmentUuid]
      const response = await download(attachmentUuid)
      const blob = response.blob
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const fallbackName = ensureExtension(
        attachmentInfo?.fileName || `attachment-${attachmentUuid}`,
        attachmentInfo?.fileType
      )
      link.href = objectUrl
      const parsedName = getFilenameFromHeaders(response.headers, fallbackName)
      link.download = ensureExtension(parsedName, attachmentInfo?.fileType)
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      console.error('Download attachment failed:', err)
      toast.error('附件下载失败，请稍后重试')
    } finally {
      setDownloadingUuid(null)
    }
  }

  const openDownloadConfirm = (attachmentUuid: string) => {
    if (downloadingUuid) return
    setConfirmDownloadUuid(attachmentUuid)
  }

  const closeDownloadConfirm = () => {
    if (downloadingUuid) return
    setConfirmDownloadUuid(null)
  }

  const confirmDownload = async () => {
    if (!confirmDownloadUuid) return
    const targetUuid = confirmDownloadUuid
    setConfirmDownloadUuid(null)
    await handleDownloadAttachment(targetUuid)
  }

  const closeImagePreview = () => {
    setPreviewImage((prev) => {
      if (prev?.url) {
        URL.revokeObjectURL(prev.url)
      }
      return null
    })
  }

  const openImagePreview = async (attachmentUuid: string) => {
    if (previewingUuid || downloadingUuid) return

    const attachmentInfo = attachmentInfoMap[attachmentUuid]
    const fallbackName = ensureExtension(
      attachmentInfo?.fileName || `attachment-${attachmentUuid}`,
      attachmentInfo?.fileType
    )

    if (!isImageAttachment(attachmentInfo?.fileType, fallbackName)) {
      toast.warning('该附件不是常见图片格式，暂不支持预览')
      return
    }

    setPreviewingUuid(attachmentUuid)
    try {
      const response = await download(attachmentUuid)
      const blob = response.blob
      const parsedName = getFilenameFromHeaders(response.headers, fallbackName)
      const finalName = ensureExtension(parsedName, attachmentInfo?.fileType)
      const objectUrl = URL.createObjectURL(blob)

      setPreviewImage((prev) => {
        if (prev?.url) {
          URL.revokeObjectURL(prev.url)
        }
        return {
          uuid: attachmentUuid,
          url: objectUrl,
          fileName: finalName,
        }
      })
    } catch (err) {
      console.error('Preview image failed:', err)
      toast.error('图片预览失败，请稍后重试')
    } finally {
      setPreviewingUuid(null)
    }
  }

  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="!max-w-4xl max-h-[90vh] flex flex-col">
          <AlertDialogHeader className="flex-shrink-0">
            <AlertDialogTitle className="text-2xl">
              {isLoading ? '加载中...' : message?.title || '消息详情'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              查看消息正文、发布时间、附件和可见范围信息。
            </AlertDialogDescription>
          </AlertDialogHeader>

          {!!error && (
            <p className="text-sm text-destructive">
              加载消息详情失败，请稍后重试
            </p>
          )}

          {!isLoading && message && (
            <div className="space-y-4 overflow-y-auto flex-1 px-1 -mx-1">
              {/* Message Metadata */}
              <div className="flex flex-wrap gap-2">
                {message.msgType && (
                  <Badge
                    variant={MSG_TYPE_VARIANTS[message.msgType]}
                    className={message.msgType === 'WAR_REPORT' ? 'bg-green-900/90 text-white hover:bg-green-900' : ''}
                  >
                    {MSG_TYPE_LABELS[message.msgType]}
                  </Badge>
                )}
                {message.isSecret && <Badge variant="outline">加密</Badge>}
              </div>

              <Separator />

              {/* Message Info */}
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">发布者: </span>
                    <span className="font-medium">
                      {getSenderDisplayName(message)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">会议次元时间: </span>
                    <span>{formatGameTime(message.publishGameTime)}</span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">现实时间: </span>
                  <span>{formatRealTime(message.publishRealTime)}</span>
                </div>
              </div>

              <Separator />

              {/* Message Brief */}
              {message.brief && (
                <>
                  <div>
                    <h3 className="text-sm font-semibold mb-2">摘要</h3>
                    <p className="text-sm text-muted-foreground">{message.brief}</p>
                  </div>
                  <Separator />
                </>
              )}

              {/* Message Content */}
              <div>
                <h3 className="text-sm font-semibold mb-2">详细内容</h3>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {message.content ? (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  ) : (
                    <p className="text-muted-foreground">暂无内容</p>
                  )}
                </div>
              </div>

              {/* Attachments */}
              {attachmentUuids.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold mb-2">附件（{attachmentUuids.length}）</h3>
                    <div className="space-y-2">
                      {attachmentUuids.map((attachmentUuid) => {
                        const attachmentInfo = attachmentInfoMap[attachmentUuid]
                        const filename = ensureExtension(
                          attachmentInfo?.fileName || `attachment-${attachmentUuid}`,
                          attachmentInfo?.fileType
                        )
                        return (
                        <div key={attachmentUuid} className="flex items-center justify-between gap-2 rounded border p-2">
                          <div className="min-w-0 space-y-1">
                            <p className="text-sm font-medium break-all">{filename}</p>
                            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                              <span>类型: {attachmentInfo?.fileType || '未知'}</span>
                              <span>大小: {formatFileSize(attachmentInfo?.fileSize)}</span>
                            </div>
                            {/* <p className="text-xs text-muted-foreground break-all">UUID: {attachmentUuid}</p> */}
                          </div>
                          <div className="ml-2 flex items-center gap-2 shrink-0">
                            {isImageAttachment(attachmentInfo?.fileType, filename) && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!!downloadingUuid || !!previewingUuid}
                                onClick={() => openImagePreview(attachmentUuid)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                {previewingUuid === attachmentUuid ? '查看中...' : '查看'}
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!!downloadingUuid}
                              onClick={() => openDownloadConfirm(attachmentUuid)}
                            >
                              {downloadingUuid === attachmentUuid ? '下载中...' : '下载'}
                            </Button>
                          </div>
                        </div>
                      )})}
                    </div>
                    {isLoadingAttachmentInfo && (
                      <p className="text-xs text-muted-foreground mt-2">正在加载附件信息...</p>
                    )}
                  </div>
                </>
              )}

              {/* Receiver Visibility (for managers) */}
              {canManageConference && message.isSecret && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold mb-2">可见用户</h3>
                    {receiverStatusList.length === 0 ? (
                      <p className="text-sm text-muted-foreground">暂无可见性数据</p>
                    ) : (
                      <div className="space-y-2">
                        {receiverStatusList.map((receiver) => (
                          <div key={receiver.uuid} className="rounded border p-2 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium truncate">
                                  {receiver.displayName?.trim()
                                    ? `${receiver.displayName}（${receiver.name}）`
                                    : receiver.name}
                                </p>
                                <p className="text-xs text-muted-foreground">{receiver.role}</p>
                              </div>
                              <Badge variant={receiver.isReadable ? 'secondary' : 'outline'}>
                                {receiver.isReadable ? '已可读' : '未到可读时间'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              可读时间: {formatReadableAt(receiver.readableAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <AlertDialogFooter className="flex-shrink-0">
            <AlertDialogCancel>关闭</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDownloadUuid} onOpenChange={(nextOpen) => !nextOpen && closeDownloadConfirm()}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>确认下载附件</AlertDialogTitle>
            <AlertDialogDescription>
              为避免误触导致连续下载，占用服务器资源，请确认是否继续下载该附件？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={!!downloadingUuid} onClick={closeDownloadConfirm}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction type="button" disabled={!!downloadingUuid} onClick={confirmDownload}>
              确认下载
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImagePreviewDialog
        open={!!previewImage}
        imageUrl={previewImage?.url}
        fileName={previewImage?.fileName}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeImagePreview()
          }
        }}
      />
    </>
  )
}
