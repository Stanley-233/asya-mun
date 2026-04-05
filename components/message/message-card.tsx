'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/lib/contexts/auth-context'
import type { MessageResponse } from '@/lib/api/endpoints/asyaBackendAPI.schemas'
import { Edit2, Trash2 } from 'lucide-react'

interface MessageCardProps {
  message: MessageResponse
  senderDisplayName?: string
  onEdit?: (message: MessageResponse) => void
  onDelete?: (message: MessageResponse) => void
  onClick?: (message: MessageResponse) => void
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
      displayYear = 1 - year  // 0→1, -1→2, -453→454
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

export function MessageCard({ message, senderDisplayName, onEdit, onDelete, onClick }: MessageCardProps) {
  const { canManageConference } = useAuth()

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onClick?.(message)}
    >
      <CardHeader>
        <CardTitle className="line-clamp-1">{message.title || '无标题'}</CardTitle>
        <CardDescription className="flex items-center gap-2">
          {message.msgType && (
            <Badge 
              variant={MSG_TYPE_VARIANTS[message.msgType] as any}
              className={message.msgType === 'WAR_REPORT' ? 'bg-green-900/90 text-white hover:bg-green-900' : ''}
            >
              {MSG_TYPE_LABELS[message.msgType]}
            </Badge>
          )}
          {message.isSecret && <Badge variant="outline">非公开</Badge>}
        </CardDescription>
        {canManageConference && (onEdit || onDelete) && (
          <CardAction>
            <div className="flex gap-1">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(message)
                  }}
                >
                  <Edit2 />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(message)
                  }}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              )}
            </div>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {message.brief ? `${message.brief}...` : '暂无摘要'}
        </p>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>发布者: {getSenderDisplayName(message, senderDisplayName)}</span>
            <span>会议次元时间: {formatGameTime(message.publishGameTime)}</span>
          </div>
          <div className="text-right">
            现实时间: {new Date(message.publishRealTime).toLocaleString('zh-CN')}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
