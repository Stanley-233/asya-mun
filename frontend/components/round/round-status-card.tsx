'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { parseApiPayload } from '@/lib/api/response-utils'
import {
  getCurrentQueryKey,
  useDetail,
  getListQueryKey,
  useCurrent,
} from '@/lib/api/hooks/round'
import type { RoundResponse } from '@/lib/api/generated'

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getStatusLabel(status?: RoundResponse['status']) {
  if (status === 'RUNNING') return '进行中'
  if (status === 'PAUSED') return '已暂停'
  return '未知'
}

export function RoundStatusCard() {
  const queryClient = useQueryClient()
  const [clientNow, setClientNow] = useState(() => Date.now())
  const prevRemainingRef = useRef<number | null>(null)

  const { data, isLoading, isError, refetch } = useCurrent({
    query: {
      refetchInterval: 60_000,
      refetchIntervalInBackground: true,
    },
  })

  const currentRound = useMemo(() => parseApiPayload<RoundResponse>(data), [data])
  const nextRoundId = currentRound?.nextRoundId ?? ''
  const {
    data: nextRoundDetailData,
    isLoading: nextRoundLoading,
    isError: nextRoundError,
  } = useDetail(nextRoundId, {
    query: {
      enabled: !!nextRoundId,
      refetchInterval: 60_000,
      refetchIntervalInBackground: true,
    },
  })
  const nextRound = useMemo(
    () => parseApiPayload<RoundResponse>(nextRoundDetailData),
    [nextRoundDetailData],
  )

  const nextRoundDisplayName = (() => {
    if (!nextRoundId) return '未设置'
    if (nextRound?.name) return nextRound.name
    if (nextRoundLoading) return '加载中...'
    if (nextRoundError) return '未知回合'
    return '未知回合'
  })()

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClientNow(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const remainingSeconds = useMemo(() => {
    if (!currentRound) return 0
    if (currentRound.status === 'PAUSED') {
      return Math.max(0, Math.floor(currentRound.remainingSeconds))
    }

    const serverMs = Date.parse(currentRound.serverTime)
    const baseMs = Number.isNaN(serverMs) ? clientNow : serverMs
    const elapsed = Math.floor((clientNow - baseMs) / 1000)
    return Math.max(0, currentRound.remainingSeconds - Math.max(0, elapsed))
  }, [clientNow, currentRound])

  useEffect(() => {
    if (!currentRound || currentRound.status !== 'RUNNING') {
      prevRemainingRef.current = null
      return
    }

    const prev = prevRemainingRef.current
    if (prev !== null && prev > 0 && remainingSeconds === 0) {
      refetch()
      queryClient.invalidateQueries({ queryKey: getCurrentQueryKey() })
      queryClient.invalidateQueries({ queryKey: getListQueryKey() })
    }
    prevRemainingRef.current = remainingSeconds
  }, [currentRound, queryClient, refetch, remainingSeconds])

  return (
    <Card className="border-2 border-primary/40">
      <CardHeader>
        <CardTitle className="text-2xl">当前回合状态</CardTitle>
        <CardDescription>独立于时间锚点的回合倒计时与状态</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">加载中...</p>
        ) : isError ? (
          <p className="text-muted-foreground">加载失败，请稍后重试</p>
        ) : !currentRound ? (
          <p className="text-muted-foreground">当前没有正在进行或暂停的回合</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xl font-semibold">{currentRound.name}</p>
              <Badge variant={currentRound.status === 'RUNNING' ? 'default' : 'secondary'}>
                {getStatusLabel(currentRound.status)}
              </Badge>
            </div>

            <div className="rounded-lg border bg-muted/20 p-4 text-center">
              <p className="text-sm text-muted-foreground">剩余时间</p>
              <p className="mt-1 font-mono text-4xl font-bold">{formatDuration(remainingSeconds)}</p>
            </div>

            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">下一回合: </span>
                {nextRoundDisplayName}
              </p>
              <p>
                <span className="text-muted-foreground">总时长: </span>
                {formatDuration(currentRound.durationSeconds)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
