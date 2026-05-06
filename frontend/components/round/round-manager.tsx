'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/lib/contexts/auth-context'
import { parseApiPayload } from '@/lib/api/response-utils'
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
import type {
  RoundPublishRequestInitialStatus,
  RoundResponse,
} from '@/lib/api/generated'
import { toast } from 'react-toastify'

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

export function RoundManager() {
  const queryClient = useQueryClient()
  const { canManageConference } = useAuth()
  const [clientNow, setClientNow] = useState(() => Date.now())
  const prevRemainingRef = useRef<number | null>(null)

  const [publishName, setPublishName] = useState('')
  const [publishDurationSeconds, setPublishDurationSeconds] = useState(900)
  const [publishInitialStatus, setPublishInitialStatus] =
    useState<RoundPublishRequestInitialStatus>('RUNNING')
  const [publishNextRoundId, setPublishNextRoundId] = useState('')
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [nextDrafts, setNextDrafts] = useState<NextDraftMap>({})
  const [remainingDrafts, setRemainingDrafts] = useState<RemainingDraftMap>({})
  const [savingRoundId, setSavingRoundId] = useState<string | null>(null)
  const [savingRemainingRoundId, setSavingRemainingRoundId] = useState<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDurationSeconds, setEditDurationSeconds] = useState(0)
  const [setCurrentDialogOpen, setSetCurrentDialogOpen] = useState(false)
  const [targetCurrentRoundId, setTargetCurrentRoundId] = useState<string | null>(null)

  const { data: currentData, isLoading: currentLoading } = useCurrent({
    query: {
      enabled: canManageConference,
      refetchInterval: 60_000,
      refetchIntervalInBackground: true,
    },
  })
  const { data: listData, isLoading: listLoading } = useList({
    query: {
      enabled: canManageConference,
      refetchInterval: 60_000,
      refetchIntervalInBackground: true,
    },
  })

  const publishMutation = usePublish()
  const pauseMutation = usePause()
  const resumeMutation = useResume()
  const setNextMutation = useSetNext()
  const updateRemainingMutation = useUpdateRemaining()
  const updateMutation = useUpdate()
  const updateCurrentMutation = useUpdateCurrent()

  const currentRound = useMemo(() => parseApiPayload<RoundResponse>(currentData), [currentData])
  const rounds = useMemo(() => parseApiPayload<RoundResponse[]>(listData) ?? [], [listData])
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
    const timer = window.setInterval(() => {
      setClientNow(Date.now())
    }, 1000)
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

  if (!canManageConference) {
    return null
  }

  const invalidateRoundQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getCurrentQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListQueryKey() }),
    ])
  }

  const handlePublish = async () => {
    const name = publishName.trim()
    if (!name) {
      toast.warning('请输入回合名称')
      return
    }
    if (!Number.isFinite(publishDurationSeconds) || publishDurationSeconds <= 0) {
      toast.warning('回合时长必须是大于 0 的秒数')
      return
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
      setPublishDialogOpen(false)
      await invalidateRoundQueries()
    } catch (error) {
      console.error('Publish round failed:', error)
      toast.error('回合发布失败，请稍后重试')
    }
  }

  const handleToggleCurrent = async () => {
    if (!currentRound) {
      toast.warning('当前没有可操作的回合')
      return
    }

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
      await setNextMutation.mutateAsync({
        roundId,
        data: { nextRoundId },
      })
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

    if (!rawValue) {
      toast.warning('请输入剩余秒数')
      return
    }
    if (!Number.isFinite(remainingSeconds) || remainingSeconds < 0) {
      toast.warning('剩余秒数必须是大于等于 0 的数字')
      return
    }

    try {
      setSavingRemainingRoundId(roundId)
      await updateRemainingMutation.mutateAsync({
        roundId,
        data: { remainingSeconds: Math.floor(remainingSeconds) },
      })
      toast.success('剩余时间已更新')
      await invalidateRoundQueries()
    } catch (error) {
      console.error('Update round remaining failed:', error)
      toast.error('设置剩余时间失败，请稍后重试')
    } finally {
      setSavingRemainingRoundId(null)
    }
  }

  const openEditDialog = (round: RoundResponse) => {
    setEditingRoundId(round.roundId)
    setEditName(round.name)
    setEditDurationSeconds(Math.max(1, Math.floor(round.durationSeconds)))
    setEditDialogOpen(true)
  }

  const handleSaveRoundEdit = async () => {
    const roundId = editingRoundId
    const name = editName.trim()

    if (!roundId) {
      toast.warning('未选择要修改的回合')
      return
    }
    if (!name) {
      toast.warning('请输入回合名称')
      return
    }
    if (!Number.isFinite(editDurationSeconds) || editDurationSeconds <= 0) {
      toast.warning('回合时长必须是大于 0 的秒数')
      return
    }

    try {
      await updateMutation.mutateAsync({
        roundId,
        data: {
          name,
          durationSeconds: Math.floor(editDurationSeconds),
        },
      })
      toast.success('回合修改成功')
      setEditDialogOpen(false)
      setEditingRoundId(null)
      await invalidateRoundQueries()
    } catch (error) {
      console.error('Update round failed:', error)
      toast.error('修改回合失败，请稍后重试')
    }
  }

  const openSetCurrentDialog = (roundId: string) => {
    setTargetCurrentRoundId(roundId)
    setSetCurrentDialogOpen(true)
  }

  const handleSetCurrent = async () => {
    const roundId = targetCurrentRoundId
    if (!roundId) {
      toast.warning('未选择目标回合')
      return
    }

    const targetRound = rounds.find((item) => item.roundId === roundId)
    if (targetRound?.isCurrent) {
      toast.warning('该回合已是当前回合')
      setSetCurrentDialogOpen(false)
      return
    }

    try {
      await updateCurrentMutation.mutateAsync({
        data: { roundId },
      })
      toast.success('已切换当前回合')
      setSetCurrentDialogOpen(false)
      setTargetCurrentRoundId(null)
      await invalidateRoundQueries()
    } catch (error) {
      console.error('Set current round failed:', error)
      toast.error('设置当前回合失败，请稍后重试')
    }
  }

  const targetCurrentRound =
    rounds.find((item) => item.roundId === targetCurrentRoundId) ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle>回合管理</CardTitle>
        <CardDescription>发布回合、控制暂停/恢复、配置回合链路（独立于时间锚点）</CardDescription>
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
              <p>
                <span className="text-muted-foreground">名称: </span>
                {currentRound.name}
              </p>
              <p>
                <span className="text-muted-foreground">剩余时间: </span>
                {formatDuration(displayRemainingSeconds)}
              </p>
              <p>
                <span className="text-muted-foreground">下一回合: </span>
                <span className="font-mono">{currentRound.nextRoundId || '未设置'}</span>
              </p>
            </div>
          )}

          <Button
            onClick={handleToggleCurrent}
            disabled={
              !currentRound ||
              pauseMutation.isPending ||
              resumeMutation.isPending
            }
            className="w-full"
            variant={currentRound?.status === 'RUNNING' ? 'outline' : 'default'}
          >
            {currentRound?.status === 'RUNNING' ? '暂停当前回合' : '恢复当前回合'}
          </Button>
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">发布新回合</h3>
          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">名称: </span>
              {publishName || '未填写'}
            </p>
            <p className="mt-1">
              <span className="text-muted-foreground">时长: </span>
              {publishDurationSeconds > 0 ? `${publishDurationSeconds} 秒` : '未填写'}
            </p>
          </div>
          <Button onClick={() => setPublishDialogOpen(true)} className="w-full">
            打开发布新回合
          </Button>
        </div>

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
                      {round.name}
                      {round.isCurrent ? '（当前）' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">{round.roundId}</p>
                  </div>
                  <Badge variant={round.status === 'RUNNING' ? 'default' : 'secondary'}>
                    {getStatusLabel(round.status)}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>当前回合总时长: {formatDuration(round.durationSeconds)}</p>
                  <p>剩余时长: {formatDuration(round.remainingSeconds)}</p>
                </div>

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

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(round)}
                    disabled={updateMutation.isPending}
                  >
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => openSetCurrentDialog(round.roundId)}
                    disabled={round.isCurrent || updateCurrentMutation.isPending}
                  >
                    {round.isCurrent ? '当前回合' : '设为当前'}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>

      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent className="!max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>发布新回合</AlertDialogTitle>
            <AlertDialogDescription>发布后将立即切换为当前回合，可同时设置初始状态与下一回合</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
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
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish} disabled={publishMutation.isPending}>
              {publishMutation.isPending ? '发布中...' : '发布并切换为当前回合'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) {
            setEditingRoundId(null)
          }
        }}
      >
        <AlertDialogContent className="!max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>修改回合</AlertDialogTitle>
            <AlertDialogDescription>可修改回合名称和总时长</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="round-edit-name">回合名称</Label>
              <Input
                id="round-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="例如：第二轮非正式磋商"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="round-edit-duration">总时长（秒）</Label>
              <Input
                id="round-edit-duration"
                type="number"
                min="1"
                value={editDurationSeconds}
                onChange={(e) => setEditDurationSeconds(parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveRoundEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '保存中...' : '保存修改'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={setCurrentDialogOpen}
        onOpenChange={(open) => {
          setSetCurrentDialogOpen(open)
          if (!open) {
            setTargetCurrentRoundId(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认切换当前回合</AlertDialogTitle>
            <AlertDialogDescription>
              确认将当前回合切换为「{targetCurrentRound?.name || '未命名回合'}」吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateCurrentMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleSetCurrent} disabled={updateCurrentMutation.isPending}>
              {updateCurrentMutation.isPending ? '切换中...' : '确认切换'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
