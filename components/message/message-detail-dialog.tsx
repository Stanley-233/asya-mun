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
import type { MessageResponse } from '@/lib/api/endpoints/asyaBackendAPI.schemas'
import { Separator } from '@/components/ui/separator'

interface MessageDetailDialogProps {
  messageUuid: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MSG_TYPE_LABELS = {
  EVENT: '事件',
  NEWS: '新闻',
  CRISIS: '危机',
} as const

const MSG_TYPE_VARIANTS = {
  EVENT: 'default',
  NEWS: 'secondary',
  CRISIS: 'destructive',
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
      displayYear = 1 - year  // 0→1, -1→2, -453→454
    } else {
      displayYear = year
    }
    
    return `${era}${displayYear}年${month}月${day}日 ${hour}:${minute}`
  } catch (err) {
    return isoString
  }
}

export function MessageDetailDialog({
  messageUuid,
  open,
  onOpenChange,
}: MessageDetailDialogProps) {
  const { data, isLoading, error } = useGetOne(messageUuid || '', {
    query: {
      enabled: !!messageUuid && open,
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

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="default">
        <AlertDialogHeader>
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
          <div className="space-y-4">
            {/* Message Metadata */}
            <div className="flex flex-wrap gap-2">
              {message.msgType && (
                <Badge variant={MSG_TYPE_VARIANTS[message.msgType] as any}>
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
                  <span className="font-medium">{message.senderName || '未知'}</span>
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
              <div 
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: message.content || '<p class="text-muted-foreground">暂无内容</p>' 
                }}
              />
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>关闭</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
