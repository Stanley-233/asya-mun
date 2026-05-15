'use client'

import type { ComponentProps } from 'react'
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
import type { MessageResponse } from '@/lib/api/generated'
import { Edit2, Trash2 } from 'lucide-react'

interface MessageCardProps {
  message: MessageResponse
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
} as const satisfies Record<
  keyof typeof MSG_TYPE_LABELS,
  NonNullable<ComponentProps<typeof Badge>['variant']>
>

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

function getSenderDisplayName(message: MessageResponse): string {
  return message.senderDisplayName?.trim() || message.senderName?.trim() || '未知'
}

export function MessageCard({ message, onEdit, onDelete, onClick }: MessageCardProps) {
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
              variant={MSG_TYPE_VARIANTS[message.msgType]}
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
            <span>发布者: {getSenderDisplayName(message)}</span>
            <span>会议次元时间: {formatGameTime(message.publishGameTime)}</span>
          </div>
          <div className="text-right">
            现实时间: {formatRealTime(message.publishRealTime)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
