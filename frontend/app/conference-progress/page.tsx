'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/contexts/auth-context"
import { buildLoginRedirect } from '@/lib/auth/return-to'
import { CurrentGameTimeCard } from "@/components/current-game-time-card"
import { useCurrentGameTime } from "@/lib/hooks/use-current-game-time"
import { useGetAll1, useGetLatest, useJump, useUpdate3 } from "@/lib/api/hooks/timeline"
import {
  getCurrentQueryKey,
  getListQueryKey,
  useCurrent,
  useList,
  usePause,
  usePublish,
  useResume,
  useSetNext,
  useUpdate,
  useUpdateCurrent,
  useUpdateRemaining,
} from '@/lib/api/hooks/round'
import type { TimeAnchorResponse, RoundPublishRequestInitialStatus, RoundResponse } from "@/lib/api/generated"
import { toast } from 'react-toastify'
import { parseApiPayload } from '@/lib/api/response-utils'

type NextDraftMap = Record<string, string>
type RemainingDraftMap = Record<string, string>

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

export default function ConferenceProgressPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, isLoading: authLoading, isAuthenticated, canManageConference } = useAuth()

  const canManage = user?.role === 'DM' || user?.role === 'DH' || user?.role === 'SYS_ADMIN'

  // ─── Timeline ───
  const { refetch: refetchAnchors } = useGetAll1()
  const { data: latestAnchorData, refetch: refetchLatest } = useGetLatest()
  const jumpMutation = useJump()
  const updateMutation = useUpdate3()
  const latestAnchor = useMemo(
    () => parseApiPayload<TimeAnchorResponse>(latestAnchorData),
    [latestAnchorData],
  )
  const currentGameTime = useCurrentGameTime(latestAnchor)

  const [targetYear, setTargetYear] = useState<number>(-450)
  const [targetMonth, setTargetMonth] = useState<number>(1)
  const [targetDay, setTargetDay] = useState<number>(1)
  const [targetHour, setTargetHour] = useState<number>(0)
  const [targetMinute, setTargetMinute] = useState<number>(0)
  const [targetSecond, setTargetSecond] = useState<number>(0)
  const [timeRatio, setTimeRatio] = useState<number>(1)

  const handleTimeJump = async () => {
    try {
      let yearStr = ''
      if (targetYear < 0) {
        yearStr = '-' + Math.abs(targetYear).toString().padStart(4, '0')
      } else {
        yearStr = targetYear.toString().padStart(4, '0')
      }
      const month = targetMonth.toString().padStart(2, '0')
      const day = targetDay.toString().padStart(2, '0')
      const hour = targetHour.toString().padStart(2, '0')
      const minute = targetMinute.toString().padStart(2, '0')
      const second = targetSecond.toString().padStart(2, '0')
      const targetGameTime = `${yearStr}-${month}-${day}T${hour}:${minute}:${second}`

      await jumpMutation.mutateAsync({ data: { targetGameTime, timeRatio } })
      toast.success('时间跳跃成功')
      refetchAnchors()
      refetchLatest()
    } catch (err) {
      console.error('Time jump failed:', err)
      toast.error('时间跳跃失败')
    }
  }

  const handleTimeUpdate = async (newRatio: number) => {
    try {
      await updateMutation.mutateAsync({ data: { timeRatio: newRatio } })
      toast.success(`时间流速已调整为 ${newRatio}x`)
      refetchAnchors()
      refetchLatest()
    } catch (err) {
      console.error('Time update failed:', err)
      toast.error('时间轴更新失败')
    }
  }

  // ─── Round ───
  const [clientNow, setClientNow] = useState(() => Date.now())
  const prevRemainingRef = useRef<number | null>(null)

  const [publishName, setPublishName] = useState('')
  const [publishDurationSeconds, setPublishDurationSeconds] = useState(900)
  const [publishInitialStatus, setPublishInitialStatus] = useState<RoundPublishRequestInitialStatus>('RUNNING')
  const [publishNextRoundId, setPublishNextRoundId] = useState('')

  const [nextDrafts, setNextDrafts] = useState<NextDraftMap>({})
  const [remainingDrafts, setRemainingDrafts] = useState<RemainingDraftMap>({})
  const [savingRoundId, setSavingRoundId] = useState<string | null>(null)
  const [savingRemainingRoundId, setSavingRemainingRoundId] = useState<string | null>(null)

  const [editingRoundId, setEditingRoundId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDurationSeconds, setEditDurationSeconds] = useState(0)

  const { data: currentData, isLoading: currentLoading } = useCurrent({
    query: { enabled: canManage, refetchInterval: 60_000, refetchIntervalInBackground: true },
  })
  const { data: listData, isLoading: listLoading } = useList({
    query: { enabled: canManage, refetchInterval: 60_000, refetchIntervalInBackground: true },
  })

  const publishMutation = usePublish()
  const pauseMutation = usePause()
  const resumeMutation = useResume()
  const setNextMutation = useSetNext()
  const updateRemainingMutation = useUpdateRemaining()
  const roundUpdateMutation = useUpdate()
  const updateCurrentMutation = useUpdateCurrent()

  const currentRound = useMemo(() => currentData ?? null, [currentData])
  const rounds = useMemo(() => listData ?? [], [listData])

  const displayRemainingSeconds = useMemo(() => {
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
    setNextDrafts((prev) => {
      const nextMap: NextDraftMap = {}
      for (const round of rounds) {
        nextMap[round.roundId] = prev[round.roundId] ?? round.nextRoundId ?? ''
      }
      return nextMap
    })
  }, [rounds])

  useEffect(() => {
    setRemainingDrafts((prev) => {
      const nextMap: RemainingDraftMap = {}
      for (const round of rounds) {
        const existing = prev[round.roundId]
        nextMap[round.roundId] =
          existing !== undefined ? existing : String(Math.max(0, Math.floor(round.remainingSeconds)))
      }
      return nextMap
    })
  }, [rounds])

  useEffect(() => {
    const timer = window.setInterval(() => setClientNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!currentRound || currentRound.status !== 'RUNNING') {
      prevRemainingRef.current = null
      return
    }
    const prev = prevRemainingRef.current
    if (prev !== null && prev > 0 && displayRemainingSeconds === 0) {
      queryClient.invalidateQueries({ queryKey: getCurrentQueryKey() })
      queryClient.invalidateQueries({ queryKey: getListQueryKey() })
    }
    prevRemainingRef.current = displayRemainingSeconds
  }, [currentRound, displayRemainingSeconds, queryClient])

  // ─── Auth ───
  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.push(buildLoginRedirect())
      return
    }
    if (!canManage) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, canManage, router])

  const invalidateRoundQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getCurrentQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListQueryKey() }),
    ])
  }

  const handlePublish = async () => {
    const name = publishName.trim()
    if (!name) { toast.warning('请输入回合名称'); return }
    if (!Number.isFinite(publishDurationSeconds) || publishDurationSeconds <= 0) {
      toast.warning('回合时长必须是大于 0 的秒数'); return
    }
    try {
      await publishMutation.mutateAsync({
        data: {
          name,
          durationSeconds: Math.floor(publishDurationSeconds),
          initialStatus: publishInitialStatus,
          nextRoundId: publishNextRoundId || undefined,
        },
      })
      toast.success('回合发布成功')
      setPublishName('')
      setPublishDurationSeconds(900)
      setPublishInitialStatus('RUNNING')
      setPublishNextRoundId('')
      await invalidateRoundQueries()
    } catch (error) {
      console.error('Publish round failed:', error)
      toast.error('回合发布失败，请稍后重试')
    }
  }

  const handleToggleCurrent = async () => {
    if (!currentRound) { toast.warning('当前没有可操作的回合'); return }
    try {
      if (currentRound.status === 'RUNNING') {
        await pauseMutation.mutateAsync({ roundId: currentRound.roundId })
        toast.success('已暂停当前回合')
      } else {
        await resumeMutation.mutateAsync({ roundId: currentRound.roundId })
        toast.success('已恢复当前回合')
      }
      await invalidateRoundQueries()
    } catch (error) {
      console.error('Toggle round status failed:', error)
      toast.error('操作失败，请稍后重试')
    }
  }

  const handleSaveNext = async (roundId: string) => {
    try {
      setSavingRoundId(roundId)
      const nextRoundId = nextDrafts[roundId] || undefined
      await setNextMutation.mutateAsync({ roundId, data: { nextRoundId } })
      toast.success(nextRoundId ? '下一回合已更新' : '下一回合已清空')
      await invalidateRoundQueries()
    } catch (error) {
      console.error('Set next round failed:', error)
      toast.error('设置下一回合失败，请稍后重试')
    } finally {
      setSavingRoundId(null)
    }
  }

  const handleSaveRemaining = async (roundId: string) => {
    const rawValue = (remainingDrafts[roundId] ?? '').trim()
    const remainingSeconds = Number(rawValue)
    if (!rawValue) { toast.warning('请输入剩余秒数'); return }
    if (!Number.isFinite(remainingSeconds) || remainingSeconds < 0) {
      toast.warning('剩余秒数必须是大于等于 0 的数字'); return
    }
    try {
      setSavingRemainingRoundId(roundId)
      await updateRemainingMutation.mutateAsync({ roundId, data: { remainingSeconds: Math.floor(remainingSeconds) } })
      toast.success('剩余时间已更新')
      await invalidateRoundQueries()
    } catch (error) {
      console.error('Update round remaining failed:', error)
      toast.error('设置剩余时间失败，请稍后重试')
    } finally {
      setSavingRemainingRoundId(null)
    }
  }

  const openEditForm = (round: RoundResponse) => {
    setEditingRoundId(round.roundId)
    setEditName(round.name)
    setEditDurationSeconds(Math.max(1, Math.floor(round.durationSeconds)))
  }

  const handleSaveRoundEdit = async () => {
    const roundId = editingRoundId
    const name = editName.trim()
    if (!roundId) { toast.warning('未选择要修改的回合'); return }
    if (!name) { toast.warning('请输入回合名称'); return }
    if (!Number.isFinite(editDurationSeconds) || editDurationSeconds <= 0) {
      toast.warning('回合时长必须是大于 0 的秒数'); return
    }
    try {
      await roundUpdateMutation.mutateAsync({ roundId, data: { name, durationSeconds: Math.floor(editDurationSeconds) } })
      toast.success('回合修改成功')
      setEditingRoundId(null)
      await invalidateRoundQueries()
    } catch (error) {
      console.error('Update round failed:', error)
      toast.error('修改回合失败，请稍后重试')
    }
  }

  const handleSetCurrent = async (roundId: string) => {
    const targetRound = rounds.find((item) => item.roundId === roundId)
    if (targetRound?.isCurrent) { toast.warning('该回合已是当前回合'); return }
    try {
      await updateCurrentMutation.mutateAsync({ data: { roundId } })
      toast.success('已切换当前回合')
      await invalidateRoundQueries()
    } catch (error) {
      console.error('Set current round failed:', error)
      toast.error('设置当前回合失败，请稍后重试')
    }
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

  if (!canManage) return null

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">会议进程</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ─── 左栏：次元时间管理 ─── */}
          <div className="space-y-6">
            <CurrentGameTimeCard currentGameTime={currentGameTime} latestAnchor={latestAnchor} />

            {/* 时间跳跃 */}
            <Card>
              <CardHeader>
                <CardTitle>时间跨度跳跃</CardTitle>
                <CardDescription>快进或回溯到指定会议次元时间</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 快捷设置 */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTargetYear(-450); setTargetMonth(1); setTargetDay(1)
                      setTargetHour(0); setTargetMinute(0); setTargetSecond(0)
                    }}
                  >
                    会议开始 (BC 450)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (currentGameTime) {
                        setTargetYear(currentGameTime.getFullYear())
                        setTargetMonth(currentGameTime.getMonth() + 1)
                        setTargetDay(currentGameTime.getDate())
                        setTargetHour(currentGameTime.getHours())
                        setTargetMinute(currentGameTime.getMinutes())
                        setTargetSecond(currentGameTime.getSeconds())
                      }
                    }}
                    disabled={!currentGameTime}
                  >
                    使用当前时间
                  </Button>
                </div>

                {/* 目标时间预览 */}
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <span className="text-muted-foreground">目标时间: </span>
                  {targetYear <= 0 ? `BC ${1 - targetYear}` : `AD ${targetYear}`}年
                  {String(targetMonth).padStart(2, '0')}月{String(targetDay).padStart(2, '0')}日{' '}
                  {String(targetHour).padStart(2, '0')}:{String(targetMinute).padStart(2, '0')}:{String(targetSecond).padStart(2, '0')}
                </div>

                {/* 日期 */}
                <div className="space-y-2">
                  <Label>日期</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Input
                        type="number"
                        value={targetYear}
                        onChange={(e) => setTargetYear(parseInt(e.target.value) || 0)}
                        placeholder="年"
                        className="text-center"
                      />
                      <p className="text-xs text-muted-foreground text-center mt-1">
                        {targetYear <= 0 ? `BC ${1 - targetYear}` : `AD ${targetYear}`}
                      </p>
                    </div>
                    <div>
                      <Input
                        type="number"
                        min="1" max="12"
                        value={targetMonth}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1
                          setTargetMonth(Math.max(1, Math.min(12, val)))
                        }}
                        placeholder="月"
                        className="text-center"
                      />
                      <p className="text-xs text-muted-foreground text-center mt-1">月</p>
                    </div>
                    <div>
                      <Input
                        type="number"
                        min="1" max="31"
                        value={targetDay}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1
                          setTargetDay(Math.max(1, Math.min(31, val)))
                        }}
                        placeholder="日"
                        className="text-center"
                      />
                      <p className="text-xs text-muted-foreground text-center mt-1">日</p>
                    </div>
                  </div>
                </div>

                {/* 时间 */}
                <div className="space-y-2">
                  <Label>时间</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Input
                        type="number"
                        min="0" max="23"
                        value={targetHour}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0
                          setTargetHour(Math.max(0, Math.min(23, val)))
                        }}
                        placeholder="时"
                        className="text-center"
                      />
                      <p className="text-xs text-muted-foreground text-center mt-1">时</p>
                    </div>
                    <div>
                      <Input
                        type="number"
                        min="0" max="59"
                        value={targetMinute}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0
                          setTargetMinute(Math.max(0, Math.min(59, val)))
                        }}
                        placeholder="分"
                        className="text-center"
                      />
                      <p className="text-xs text-muted-foreground text-center mt-1">分</p>
                    </div>
                    <div>
                      <Input
                        type="number"
                        min="0" max="59"
                        value={targetSecond}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0
                          setTargetSecond(Math.max(0, Math.min(59, val)))
                        }}
                        placeholder="秒"
                        className="text-center"
                      />
                      <p className="text-xs text-muted-foreground text-center mt-1">秒</p>
                    </div>
                  </div>
                </div>

                {/* 流速 */}
                <div className="space-y-2">
                  <Label htmlFor="time-ratio">时间流速</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="time-ratio"
                      type="number"
                      step="0.1"
                      min="0"
                      value={timeRatio}
                      onChange={(e) => setTimeRatio(parseFloat(e.target.value) || 0)}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">x 倍速</span>
                  </div>
                  <p className="text-xs text-muted-foreground">0 = 暂停，1 = 实时，2 = 2倍速</p>
                </div>

                <Button onClick={handleTimeJump} disabled={jumpMutation.isPending} className="w-full">
                  {jumpMutation.isPending ? '跳跃中...' : '执行时间跳跃'}
                </Button>

                {/* 快捷流速 */}
                <div className="border-t pt-4">
                  <Label className="mb-2 block">快捷流速调整</Label>
                  <div className="grid grid-cols-4 gap-2">
                    <Button variant="outline" onClick={() => handleTimeUpdate(0)} disabled={updateMutation.isPending}>暂停</Button>
                    <Button variant="outline" onClick={() => handleTimeUpdate(1)} disabled={updateMutation.isPending}>1x</Button>
                    <Button variant="outline" onClick={() => handleTimeUpdate(2)} disabled={updateMutation.isPending}>2x</Button>
                    <Button variant="outline" onClick={() => handleTimeUpdate(5)} disabled={updateMutation.isPending}>5x</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── 右栏：回合管理 ─── */}
          <div className="space-y-6">
            {/* 当前回合 */}
            <Card>
              <CardHeader>
                <CardTitle>回合管理</CardTitle>
                <CardDescription>发布回合、控制暂停/恢复、配置回合链路</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">当前回合</p>
                    {currentRound ? (
                      <Badge variant={currentRound.status === 'RUNNING' ? 'default' : 'secondary'}>
                        {getStatusLabel(currentRound.status)}
                      </Badge>
                    ) : (
                      <Badge variant="outline">无当前回合</Badge>
                    )}
                  </div>
                  {currentLoading ? (
                    <p className="text-sm text-muted-foreground">加载中...</p>
                  ) : !currentRound ? (
                    <p className="text-sm text-muted-foreground">当前暂无回合</p>
                  ) : (
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">名称: </span>{currentRound.name}</p>
                      <p><span className="text-muted-foreground">剩余时间: </span>{formatDuration(displayRemainingSeconds)}</p>
                      <p><span className="text-muted-foreground">下一回合: </span><span className="font-mono">{currentRound.nextRoundId || '未设置'}</span></p>
                    </div>
                  )}
                  <Button
                    onClick={handleToggleCurrent}
                    disabled={!currentRound || pauseMutation.isPending || resumeMutation.isPending}
                    className="w-full"
                    variant={currentRound?.status === 'RUNNING' ? 'outline' : 'default'}
                  >
                    {currentRound?.status === 'RUNNING' ? '暂停当前回合' : '恢复当前回合'}
                  </Button>
                </div>

                {/* 发布新回合（内联） */}
                <div className="space-y-3 rounded-lg border p-4">
                  <h3 className="text-sm font-semibold">发布新回合</h3>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="round-name">回合名称</Label>
                      <Input
                        id="round-name"
                        value={publishName}
                        onChange={(e) => setPublishName(e.target.value)}
                        placeholder="例如：第一轮正式磋商"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="round-duration">持续时长（秒）</Label>
                      <Input
                        id="round-duration"
                        type="number"
                        min="1"
                        value={publishDurationSeconds}
                        onChange={(e) => setPublishDurationSeconds(parseInt(e.target.value, 10) || 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="round-initial-status">初始状态</Label>
                      <select
                        id="round-initial-status"
                        className="flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        value={publishInitialStatus}
                        onChange={(e) => setPublishInitialStatus(e.target.value as RoundPublishRequestInitialStatus)}
                      >
                        <option value="RUNNING">RUNNING（立即倒计时）</option>
                        <option value="PAUSED">PAUSED（先暂停）</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="round-next-on-publish">下一回合（可选）</Label>
                      <select
                        id="round-next-on-publish"
                        className="flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        value={publishNextRoundId}
                        onChange={(e) => setPublishNextRoundId(e.target.value)}
                      >
                        <option value="">不设置</option>
                        {rounds.map((round) => (
                          <option key={round.roundId} value={round.roundId}>
                            {round.name} ({round.roundId})
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button onClick={handlePublish} disabled={publishMutation.isPending} className="w-full">
                      {publishMutation.isPending ? '发布中...' : '发布并切换为当前回合'}
                    </Button>
                  </div>
                </div>

                {/* 回合链路 */}
                <div className="space-y-3 rounded-lg border p-4">
                  <h3 className="text-sm font-semibold">回合链路</h3>
                  {listLoading ? (
                    <p className="text-sm text-muted-foreground">加载中...</p>
                  ) : rounds.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无回合记录</p>
                  ) : (
                    rounds.map((round) => (
                      <div
                        key={round.roundId}
                        className={`space-y-3 rounded-lg border p-3 ${
                          round.isCurrent ? 'border-primary/60 bg-primary/5' : 'bg-muted/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">
                              {round.name}{round.isCurrent ? '（当前）' : ''}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">{round.roundId}</p>
                          </div>
                          <Badge variant={round.status === 'RUNNING' ? 'default' : 'secondary'}>
                            {getStatusLabel(round.status)}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                          <p>总时长: {formatDuration(round.durationSeconds)}</p>
                          <p>剩余时长: {formatDuration(round.remainingSeconds)}</p>
                        </div>

                        {/* 下一回合 */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <select
                            className="flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            value={nextDrafts[round.roundId] ?? ''}
                            onChange={(e) =>
                              setNextDrafts((prev) => ({ ...prev, [round.roundId]: e.target.value }))
                            }
                          >
                            <option value="">清空下一回合</option>
                            {rounds.map((candidate) => (
                              <option key={candidate.roundId} value={candidate.roundId}>
                                {candidate.name} ({candidate.roundId})
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            onClick={() => handleSaveNext(round.roundId)}
                            disabled={setNextMutation.isPending && savingRoundId === round.roundId}
                          >
                            {setNextMutation.isPending && savingRoundId === round.roundId ? '保存中...' : '保存'}
                          </Button>
                        </div>

                        {/* 剩余时间 */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Input
                            type="number"
                            min="0"
                            value={remainingDrafts[round.roundId] ?? ''}
                            onChange={(e) =>
                              setRemainingDrafts((prev) => ({ ...prev, [round.roundId]: e.target.value }))
                            }
                            placeholder="设置剩余秒数"
                            disabled={updateRemainingMutation.isPending && savingRemainingRoundId === round.roundId}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSaveRemaining(round.roundId)}
                            disabled={updateRemainingMutation.isPending && savingRemainingRoundId === round.roundId}
                          >
                            {updateRemainingMutation.isPending && savingRemainingRoundId === round.roundId
                              ? '设置中...'
                              : '设置剩余时间'}
                          </Button>
                        </div>

                        {/* 编辑/设为当前 */}
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditForm(round)}
                            disabled={roundUpdateMutation.isPending}
                          >
                            编辑
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSetCurrent(round.roundId)}
                            disabled={round.isCurrent || updateCurrentMutation.isPending}
                          >
                            {round.isCurrent ? '当前回合' : '设为当前'}
                          </Button>
                        </div>

                        {/* 编辑表单（内联展开） */}
                        {editingRoundId === round.roundId && (
                          <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
                            <div className="space-y-2">
                              <Label htmlFor={`edit-name-${round.roundId}`}>回合名称</Label>
                              <Input
                                id={`edit-name-${round.roundId}`}
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="例如：第二轮非正式磋商"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`edit-duration-${round.roundId}`}>总时长（秒）</Label>
                              <Input
                                id={`edit-duration-${round.roundId}`}
                                type="number"
                                min="1"
                                value={editDurationSeconds}
                                onChange={(e) => setEditDurationSeconds(parseInt(e.target.value, 10) || 0)}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={handleSaveRoundEdit}
                                disabled={roundUpdateMutation.isPending}
                              >
                                {roundUpdateMutation.isPending ? '保存中...' : '保存修改'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingRoundId(null)}
                              >
                                取消
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
