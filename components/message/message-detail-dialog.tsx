'use client'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { useGetOne } from '@/lib/api/endpoints/消息管理/消息管理'
import { useGetUsers } from '@/lib/api/endpoints/会议管理/会议管理'
import type { MessageResponse, UserInfoResponse } from '@/lib/api/endpoints/asyaBackendAPI.schemas'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/lib/contexts/auth-context'

interface MessageDetailDialogProps {
  messageUuid: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MSG_TYPE_LABELS = {
  EVENT: '事件',
  NEWS: '新闻',
  CRISIS: '危机',
  WAR_REPORT: '战报',
  SECRET_LETTER: '密函',
} as const

const MSG_TYPE_VARIANTS = {
  EVENT: 'default',
  NEWS: 'secondary',
  CRISIS: 'destructive',
  WAR_REPORT: 'default',
  SECRET_LETTER: 'secondary',
} as const

// 格式化游戏时间为人类可读格式
function formatGameTime(isoString: string): string {
  if (!isoString) return '未知'

  try {
    // 匹配ISO格式: -0453-12-31T20:52:00 或 2024-01-15T10:00:00
    const match = isoString.match(/^(-?\d+)-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/)
    if (!match) return isoString

    const [, yearStr, month, day, hour, minute] = match
    const year = parseInt(yearStr, 10)

    let displayYear: number
    let era = ''

    if (year <= 0) {
      era = 'BC '
      displayYear = 1 - year // 0→1, -1→2, -453→454
    } else {
      displayYear = year
    }

    return `${era}${displayYear}年${month}月${day}日 ${hour}:${minute}`
  } catch (err) {
    return isoString
  }
}

function getSenderDisplayName(message: MessageResponse, senderDisplayName?: string): string {
  const displayName = senderDisplayName?.trim()
  if (displayName) return displayName
  const fallbackDisplayName = (message as MessageResponse & { senderDisplayName?: string }).senderDisplayName?.trim()
  if (fallbackDisplayName) return fallbackDisplayName
  const senderName = message.senderName?.trim()
  return senderName || '未知'
}

export function MessageDetailDialog({
  messageUuid,
  open,
  onOpenChange,
}: MessageDetailDialogProps) {
  const { isAuthenticated } = useAuth()
  const { data, isLoading, error } = useGetOne(messageUuid || '', {
    query: {
      enabled: !!messageUuid && open,
    },
  })

  const { data: usersData } = useGetUsers({
    query: {
      enabled: isAuthenticated && open,
    },
  })

  // 解析响应数据
  const message = (() => {
    try {
      if (!data) return null
      const responseData = (data as any).data
      if (!responseData) return null

      const parsed = typeof responseData === 'string'
        ? JSON.parse(responseData)
        : responseData

      return (parsed.data || parsed) as MessageResponse
    } catch (err) {
      console.error('Failed to parse message detail:', err)
      return null
    }
  })()

  const users: UserInfoResponse[] = (() => {
    try {
      if (!usersData) return []
      const responseData = (usersData as any).data
      if (!responseData) return []

      const parsed = typeof responseData === 'string'
        ? JSON.parse(responseData)
        : responseData

      const usersList = parsed.data || parsed
      return Array.isArray(usersList) ? usersList : []
    } catch (err) {
      console.error('Failed to parse users data:', err)
      return []
    }
  })()

  const senderDisplayNameMap = users.reduce<Record<string, string>>((acc, user) => {
    const displayName = user.displayName?.trim()
    const label = displayName || user.name || ''
    if (user.uuid && label) {
      acc[user.uuid] = label
    }
    return acc
  }, {})

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="!max-w-4xl max-h-[90vh] flex flex-col">
        <AlertDialogHeader className="flex-shrink-0">
          <AlertDialogTitle className="text-2xl">
            {isLoading ? '加载中...' : message?.title || '消息详情'}
          </AlertDialogTitle>
        </AlertDialogHeader>

        {!!error && (
          <AlertDialogDescription className="text-destructive">
            加载消息详情失败，请稍后重试
          </AlertDialogDescription>
        )}

        {!isLoading && message && (
          <div className="space-y-4 overflow-y-auto flex-1 px-1 -mx-1">
            {/* Message Metadata */}
            <div className="flex flex-wrap gap-2">
              {message.msgType && (
                <Badge
                  variant={MSG_TYPE_VARIANTS[message.msgType] as any}
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
                    {getSenderDisplayName(
                      message,
                      message.senderId ? senderDisplayNameMap[message.senderId] : undefined
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">游戏时间: </span>
                  <span>{formatGameTime(message.publishGameTime)}</span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">现实时间: </span>
                <span>{new Date(message.publishRealTime).toLocaleString('zh-CN')}</span>
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
          </div>
        )}

        <AlertDialogFooter className="flex-shrink-0">
          <AlertDialogCancel>关闭</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
