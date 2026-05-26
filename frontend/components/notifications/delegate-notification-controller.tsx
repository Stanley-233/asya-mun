'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Client } from '@stomp/stompjs'
import { BellRing, Eye, Mail, MessageSquareMore, ScrollText, X } from 'lucide-react'
import { toast } from 'react-toastify'
import { Button } from '@/components/ui/button'
import { InstructionDetailDialog } from '@/components/instruction'
import { MessageDetailDialog } from '@/components/message'
import { getMyInstructions } from '@/lib/api/apis/instruction.api'
import { getAll, getSecretMessages } from '@/lib/api/apis/message.api'
import type { InstructionResponse, MessageResponse } from '@/lib/api/generated'
import { useAuth } from '@/lib/contexts/auth-context'
import { getStoredAccessToken } from '@/lib/auth/token-storage'
import { cn } from '@/lib/utils'
import {
  ensureNotificationPending,
  isNotificationResolved,
  loadNotificationResolutionState,
  markNotificationResolved,
} from '@/lib/notifications/storage'
import type { DelegateNotificationEvent } from '@/lib/notifications/types'

function buildWebSocketUrl(baseUrl?: string) {
  const fallbackBaseUrl = (() => {
    if (baseUrl?.trim()) {
      return baseUrl
    }

    if (typeof window === 'undefined') {
      return 'http://127.0.0.1:8080'
    }

    const { hostname, origin, protocol } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:8080`
    }

    return origin
  })()

  const normalizedBaseUrl = new URL(fallbackBaseUrl)
  normalizedBaseUrl.protocol = normalizedBaseUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  normalizedBaseUrl.pathname = `${normalizedBaseUrl.pathname.replace(/\/$/, '')}/ws`
  normalizedBaseUrl.search = ''
  normalizedBaseUrl.hash = ''
  return normalizedBaseUrl.toString()
}

function formatOccurredAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}/${m}/${d} ${h}:${min}:${s}`
}

function getMessageSenderName(message: MessageResponse) {
  return message.senderDisplayName?.trim() || message.senderName?.trim() || undefined
}

function getMessageBrief(message: MessageResponse) {
  const brief = message.brief?.trim()
  if (brief) return brief
  const content = message.content?.trim()
  if (!content) return '点击查看详情。'
  return content.length > 64 ? `${content.slice(0, 64)}...` : content
}

function toPublicMessageNotificationEvent(message: MessageResponse): DelegateNotificationEvent {
  return {
    eventId: `PUBLIC_MESSAGE:${message.uuid}`,
    kind: 'PUBLIC_MESSAGE',
    occurredAt: message.publishRealTime,
    messageUuid: message.uuid,
    title: message.title?.trim() || '新公开消息',
    brief: getMessageBrief(message),
    senderName: getMessageSenderName(message),
  }
}

function toSecretMessageNotificationEvent(message: MessageResponse): DelegateNotificationEvent {
  return {
    eventId: `SECRET_MESSAGE:${message.uuid}`,
    kind: 'SECRET_MESSAGE',
    occurredAt: message.publishRealTime,
    messageUuid: message.uuid,
    title: message.title?.trim() || '新的非对称消息',
    brief: getMessageBrief(message),
    senderName: getMessageSenderName(message),
  }
}

function toInstructionNotificationEvent(instruction: InstructionResponse): DelegateNotificationEvent {
  return {
    eventId: `INSTRUCTION_FEEDBACK:${instruction.uuid}`,
    kind: 'INSTRUCTION_FEEDBACK',
    occurredAt: instruction.reviewedRealTime || instruction.submitRealTime,
    instructionUuid: instruction.uuid,
    title: instruction.title.trim() || '指令已反馈',
    brief: instruction.reviewComment?.trim() || '您的指令已收到反馈，点击查看详情。',
    senderName: instruction.reviewedByName?.trim() || undefined,
  }
}

function getNotificationMeta(kind: DelegateNotificationEvent['kind']) {
  if (kind === 'PUBLIC_MESSAGE') {
    return {
      label: '公开消息',
      icon: MessageSquareMore,
      accentClassName: 'text-amber-700 bg-amber-500/14 border-amber-500/25',
    }
  }

  if (kind === 'SECRET_MESSAGE') {
    return {
      label: '非对称消息',
      icon: Mail,
      accentClassName: 'text-orange-700 bg-orange-500/14 border-orange-500/25',
    }
  }

  return {
    label: '指令反馈',
    icon: ScrollText,
    accentClassName: 'text-emerald-700 bg-emerald-500/14 border-emerald-500/25',
  }
}

function DelegateNotificationToast({
  event,
  onView,
  onDismiss,
}: {
  event: DelegateNotificationEvent
  onView: () => void
  onDismiss: () => void
}) {
  const meta = getNotificationMeta(event.kind)
  const Icon = meta.icon

  return (
    <div className="asya-notification-card">
      <div className={cn('asya-notification-card__icon', meta.accentClassName)}>
        <Icon className="size-4.5" />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {meta.label}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">
              {event.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
            aria-label="关闭提醒"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
          {event.brief}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BellRing className="size-3.5" />
            <span>{formatOccurredAt(event.occurredAt)}</span>
          </div>
          {event.senderName && (
            <span className="text-xs text-muted-foreground">
              来自 {event.senderName}
            </span>
          )}
        </div>
      </div>
      <Button
        size="sm"
        className="shrink-0"
        onClick={onView}
      >
        <Eye />
        查看
      </Button>
    </div>
  )
}

export function DelegateNotificationController() {
  const queryClient = useQueryClient()
  const { user, isAuthenticated } = useAuth()
  const clientRef = useRef<Client | null>(null)
  const seenEventIdsRef = useRef<Set<string>>(new Set())
  const visibleToastIdsRef = useRef<Set<string>>(new Set())
  const [selectedMessageUuid, setSelectedMessageUuid] = useState<string | null>(null)
  const [messageDialogOpen, setMessageDialogOpen] = useState(false)
  const [selectedInstructionUuid, setSelectedInstructionUuid] = useState<string | null>(null)
  const [instructionDialogOpen, setInstructionDialogOpen] = useState(false)
  const isDetailDialogOpen = messageDialogOpen || instructionDialogOpen

  const isEnabled = isAuthenticated && user?.role === 'DELEGATE' && !!user.conferenceUuid
  const token = getStoredAccessToken()

  const dismissTrackedToast = useEffectEvent((toastId: string) => {
    visibleToastIdsRef.current.delete(toastId)
    toast.dismiss(toastId)
  })

  const invalidateNotificationQueries = useEffectEvent(() => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const head = query.queryKey[0]
        return typeof head === 'string'
          && (head.startsWith('/api/messages') || head.startsWith('/api/instructions'))
      },
    })
  })

  const openNotificationTarget = useEffectEvent((event: DelegateNotificationEvent) => {
    if (event.kind === 'INSTRUCTION_FEEDBACK' && event.instructionUuid) {
      setSelectedInstructionUuid(event.instructionUuid)
      setInstructionDialogOpen(true)
      return
    }

    if (event.messageUuid) {
      setSelectedMessageUuid(event.messageUuid)
      setMessageDialogOpen(true)
    }
  })

  const handleNotification = useEffectEvent((event: DelegateNotificationEvent) => {
    if (!user?.uuid || !user.conferenceUuid) return
    const scope = {
      userUuid: user.uuid,
      conferenceUuid: user.conferenceUuid,
    }
    if (isNotificationResolved(scope, event)) return
    if (seenEventIdsRef.current.has(event.eventId)) return

    seenEventIdsRef.current.add(event.eventId)
    ensureNotificationPending(scope, event)
    invalidateNotificationQueries()

    visibleToastIdsRef.current.add(event.eventId)
    toast(
      <DelegateNotificationToast
        event={event}
        onDismiss={() => dismissTrackedToast(event.eventId)}
        onView={() => {
          markNotificationResolved(scope, event)
          openNotificationTarget(event)
          dismissTrackedToast(event.eventId)
        }}
      />,
      {
        toastId: event.eventId,
        autoClose: false,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
        icon: false,
        className: 'asya-delegate-toast-shell',
      },
    )
  })

  const runHttpBackfill = useEffectEvent(async (scope: { userUuid: string; conferenceUuid: string }) => {
    const resolutionState = loadNotificationResolutionState(scope)
    const pageSize = 100

    const [publicPage, secretPage, feedbackPage] = await Promise.all([
      getAll({
        pageable: {
          page: 0,
          size: pageSize,
          sort: ['publishRealTime,desc'],
        },
      }),
      getSecretMessages({
        pageable: {
          page: 0,
          size: pageSize,
          sort: ['publishRealTime,desc'],
        },
      }),
      getMyInstructions({
        status: 'FEEDBACKED',
        pageable: {
          page: 0,
          size: pageSize,
          sort: ['reviewedRealTime,desc'],
        },
      }),
    ])

    console.info('[DelegateNotification] HTTP backfill resolution state', resolutionState)
    console.info('[DelegateNotification] HTTP backfill raw counts', {
      publicCount: publicPage.content.length,
      secretCount: secretPage.content.length,
      instructionCount: feedbackPage.content.length,
      publicLatest: publicPage.content[0]?.publishRealTime,
      secretLatest: secretPage.content[0]?.publishRealTime,
      instructionLatest: feedbackPage.content[0]?.reviewedRealTime || feedbackPage.content[0]?.submitRealTime,
    })

    const publicEvents = publicPage.content
      .map(toPublicMessageNotificationEvent)
      .filter((event) => !isNotificationResolved(scope, event))

    const secretEvents = secretPage.content
      .map(toSecretMessageNotificationEvent)
      .filter((event) => !isNotificationResolved(scope, event))

    const instructionEvents = feedbackPage.content
      .map(toInstructionNotificationEvent)
      .filter((event) => !isNotificationResolved(scope, event))

    const merged = [...publicEvents, ...secretEvents, ...instructionEvents]
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())

    if (merged.length === 0 && (publicPage.content.length > 0 || secretPage.content.length > 0 || feedbackPage.content.length > 0)) {
      console.warn('[DelegateNotification] HTTP backfill found raw data but all events were already resolved', {
        resolutionState,
        publicCandidates: publicPage.content.map((item) => ({ uuid: item.uuid, occurredAt: item.publishRealTime, title: item.title })),
        secretCandidates: secretPage.content.map((item) => ({ uuid: item.uuid, occurredAt: item.publishRealTime, title: item.title })),
        instructionCandidates: feedbackPage.content.map((item) => ({
          uuid: item.uuid,
          occurredAt: item.reviewedRealTime || item.submitRealTime,
          title: item.title,
        })),
      })
    }

    console.info('[DelegateNotification] HTTP backfill events', merged)
    merged.forEach((event) => handleNotification(event))
  })

  useEffect(() => {
    if (!isEnabled || !user?.uuid || !user.conferenceUuid || !token) {
      clientRef.current?.deactivate()
      clientRef.current = null
      visibleToastIdsRef.current.forEach((toastId) => toast.dismiss(toastId))
      visibleToastIdsRef.current.clear()
      seenEventIdsRef.current.clear()
      return
    }

    let cancelled = false
    const scope = {
      userUuid: user.uuid,
      conferenceUuid: user.conferenceUuid,
    }
    const visibleToastIds = visibleToastIdsRef.current
    const seenEventIds = seenEventIdsRef.current
    const client = new Client({
      brokerURL: buildWebSocketUrl(process.env.NEXT_PUBLIC_API_BASE_URL),
      reconnectDelay: 3000,
      debug: (message) => {
        if (process.env.NODE_ENV !== 'production') {
          console.info('[DelegateNotification/STOMP]', message)
        }
      },
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      onConnect: () => {
        if (cancelled) return
        console.info('[DelegateNotification] websocket connected')
        client.subscribe('/user/queue/notifications', (message) => {
          if (cancelled) return
          try {
            console.info('[DelegateNotification] message received', message.body)
            handleNotification(JSON.parse(message.body) as DelegateNotificationEvent)
          } catch (error) {
            console.error('Delegate notification payload parse error:', error)
          }
        })
        void runHttpBackfill(scope).catch((error) => {
          console.error('Delegate notification HTTP backfill failed:', error)
        })
      },
      onStompError: (frame) => {
        console.error('Delegate notification STOMP error:', frame.body)
      },
      onWebSocketError: (event) => {
        console.error('Delegate notification websocket error:', event)
      },
      onWebSocketClose: (event) => {
        console.error(
          'Delegate notification websocket closed:',
          `code=${event.code}`,
          `reason=${event.reason || '(empty)'}`,
          `wasClean=${event.wasClean}`,
        )
      },
    })

    clientRef.current = client
    client.activate()

    return () => {
      cancelled = true
      clientRef.current?.deactivate()
      clientRef.current = null
      visibleToastIds.forEach((toastId) => toast.dismiss(toastId))
      visibleToastIds.clear()
      seenEventIds.clear()
    }
  }, [isEnabled, token, user?.conferenceUuid, user?.uuid])

  useEffect(() => {
    if (typeof document === 'undefined') return

    document.body.classList.toggle('asya-toast-muted', isDetailDialogOpen)
    return () => {
      document.body.classList.remove('asya-toast-muted')
    }
  }, [isDetailDialogOpen])

  return (
    <>
      <MessageDetailDialog
        open={messageDialogOpen}
        onOpenChange={setMessageDialogOpen}
        messageUuid={selectedMessageUuid}
      />
      <InstructionDetailDialog
        open={instructionDialogOpen}
        onOpenChange={setInstructionDialogOpen}
        instructionUuid={selectedInstructionUuid}
        canReview={false}
      />
    </>
  )
}
