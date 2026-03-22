'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CurrentGameTimeCard } from "@/components/current-game-time-card"
import { useCurrentGameTime } from "@/lib/hooks/use-current-game-time"
import { useGetAll1, useGetLatest, useJump, useUpdate3 } from "@/lib/api/endpoints/时间轴管理/时间轴管理"
import type { TimeAnchorResponse } from "@/lib/api/endpoints/asyaBackendAPI.schemas"
import { toast } from 'react-toastify'

interface TimelineManagerProps {
  currentSession?: { uuid?: string } | null
}

// 游戏开始时间：公元前450年1月1日
const GAME_START_DATE = new Date(-450, 0, 1)

export function TimelineManager({ currentSession: _currentSession }: TimelineManagerProps) {
  const { data: allAnchorsData, isLoading: anchorsLoading, refetch: refetchAnchors } = useGetAll1()
  const { data: latestAnchorData, isLoading: latestLoading, refetch: refetchLatest } = useGetLatest()
  const jumpMutation = useJump()
  const updateMutation = useUpdate3()

  const [allAnchors, setAllAnchors] = useState<TimeAnchorResponse[]>([])
  const [latestAnchor, setLatestAnchor] = useState<TimeAnchorResponse | null>(null)
  
  // 使用共享的 hook 计算当前游戏时间
  const currentGameTime = useCurrentGameTime(latestAnchor)

  // 时间跳跃表单状态
  const [targetYear, setTargetYear] = useState<number>(-450)
  const [targetMonth, setTargetMonth] = useState<number>(1)
  const [targetDay, setTargetDay] = useState<number>(1)
  const [targetHour, setTargetHour] = useState<number>(0)
  const [targetMinute, setTargetMinute] = useState<number>(0)
  const [targetSecond, setTargetSecond] = useState<number>(0)
  const [timeRatio, setTimeRatio] = useState<number>(1)
  const [jumpDialogOpen, setJumpDialogOpen] = useState(false)

  // 解析所有锚点数据
  useEffect(() => {
    if (allAnchorsData && !anchorsLoading) {
      try {
        const responseData = (allAnchorsData as any).data
        if (responseData) {
          const parsedData = typeof responseData === 'string' 
            ? JSON.parse(responseData) 
            : responseData
          
          const anchors = parsedData.data || []
          setAllAnchors(Array.isArray(anchors) ? anchors : [])
        }
      } catch (err) {
        console.error('Failed to parse anchors data:', err)
        setAllAnchors([])
      }
    }
  }, [allAnchorsData, anchorsLoading])

  // 解析最新锚点数据
  useEffect(() => {
    if (latestAnchorData && !latestLoading) {
      try {
        console.log('📦 [最新锚点] 原始响应数据:', latestAnchorData)
        
        const responseData = (latestAnchorData as any).data
        if (responseData) {
          const parsedData = typeof responseData === 'string' 
            ? JSON.parse(responseData) 
            : responseData
          
          console.log('📦 [最新锚点] 解析后数据:', parsedData)
          
          const anchor = parsedData.data || null
          console.log('⚓ [最新锚点] 锚点对象:', anchor)
          
          if (anchor?.anchorGameTime) {
            console.log('🎮 [最新锚点] anchorGameTime:', anchor.anchorGameTime, '类型:', typeof anchor.anchorGameTime)
          }
          
          setLatestAnchor(anchor)
        }
      } catch (err) {
        console.error('❌ Failed to parse latest anchor data:', err)
        setLatestAnchor(null)
      }
    }
  }, [latestAnchorData, latestLoading])

  // 处理时间跳跃
  const handleTimeJump = async () => {
    try {
      // 构造目标时间字符串（LocalDateTime格式，不带时区）
      // 格式: YYYY-MM-DDTHH:mm:ss
      // 负数年份格式: -0450（负号+至少4位数字）
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

      console.log('🚀 [时间跳跃] 准备提交到后端:', {
        targetYear,
        yearStr,
        month,
        day,
        hour,
        minute,
        second,
        targetGameTime,
        timeRatio
      })

      await jumpMutation.mutateAsync({
        data: {
          targetGameTime,
          timeRatio
        }
      })

      console.log('✅ [时间跳跃] 提交成功')
      toast.success('时间跳跃成功')
      setJumpDialogOpen(false)
      // 刷新数据
      refetchAnchors()
      refetchLatest()
    } catch (err) {
      console.error('Time jump failed:', err)
      toast.error('时间跳跃失败')
    }
  }

  // 处理时间轴更新（启动/恢复/变速）
  const handleTimeUpdate = async (newRatio: number) => {
    try {
      await updateMutation.mutateAsync({
        data: {
          timeRatio: newRatio
        }
      })

      toast.success(`时间流速已调整为 ${newRatio}x`)
      // 刷新数据
      refetchAnchors()
      refetchLatest()
    } catch (err) {
      console.error('Time update failed:', err)
      toast.error('时间轴更新失败')
    }
  }

  // 格式化游戏时间显示（用于锚点列表）
  // JavaScript Date遵循ISO 8601: 0年=BC1, -1年=BC2, -420年=BC421
  const formatGameTime = (date: Date | null) => {
    if (!date) return '未知'
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    // ISO 8601到历史年份的转换
    let era: string
    let displayYear: number
    
    if (year <= 0) {
      era = 'BC'
      displayYear = 1 - year  // 0→1, -1→2, -420→421
    } else {
      era = 'AD'
      displayYear = year
    }

    return `${era} ${displayYear}年${month}月${day}日 ${hours}:${minutes}:${seconds}`
  }

  // 格式化时间戳（用于锚点列表）
  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return '未知'
    try {
      const date = new Date(timestamp)
      return date.toLocaleString('zh-CN')
    } catch {
      return '未知'
    }
  }

  return (
    <div className="space-y-6">
      {/* 当前游戏时间显示 */}
      <CurrentGameTimeCard 
        currentGameTime={currentGameTime}
        latestAnchor={latestAnchor}
      />

      {/* 时间跳跃控制 */}
      <Card>
        <CardHeader>
          <CardTitle>时间跨度跳跃</CardTitle>
          <CardDescription>快进或回溯到指定游戏时间</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-sm">
              <span className="text-muted-foreground">目标时间: </span>
              {targetYear <= 0 ? `BC ${1 - targetYear}` : `AD ${targetYear}`}年
              {String(targetMonth).padStart(2, '0')}月
              {String(targetDay).padStart(2, '0')}日
              {' '}
              {String(targetHour).padStart(2, '0')}:
              {String(targetMinute).padStart(2, '0')}:
              {String(targetSecond).padStart(2, '0')}
            </p>
            <p className="mt-1 text-sm">
              <span className="text-muted-foreground">流速: </span>
              {timeRatio}x
            </p>
          </div>

          <Button onClick={() => setJumpDialogOpen(true)} className="w-full">
            打开时间跳跃
          </Button>

          {/* 快捷时间流速调整 */}
          <div className="border-t pt-4">
            <Label className="mb-2 block">快捷流速调整</Label>
            <div className="grid grid-cols-4 gap-2">
              <Button
                variant="outline"
                onClick={() => handleTimeUpdate(0)}
                disabled={updateMutation.isPending}
              >
                暂停
              </Button>
              <Button
                variant="outline"
                onClick={() => handleTimeUpdate(1)}
                disabled={updateMutation.isPending}
              >
                1x
              </Button>
              <Button
                variant="outline"
                onClick={() => handleTimeUpdate(2)}
                disabled={updateMutation.isPending}
              >
                2x
              </Button>
              <Button
                variant="outline"
                onClick={() => handleTimeUpdate(5)}
                disabled={updateMutation.isPending}
              >
                5x
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={jumpDialogOpen} onOpenChange={setJumpDialogOpen}>
        <AlertDialogContent className="!max-w-3xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>时间跨度跳跃</AlertDialogTitle>
            <AlertDialogDescription>快进或回溯到指定游戏时间，并设置目标流速</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">快捷设置</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTargetYear(-450)
                    setTargetMonth(1)
                    setTargetDay(1)
                    setTargetHour(0)
                    setTargetMinute(0)
                    setTargetSecond(0)
                  }}
                >
                  游戏开始 (BC 450)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (currentGameTime) {
                      const year = currentGameTime.getFullYear()
                      setTargetYear(year)
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
            </div>

            <div className="border-t pt-4 space-y-4">
              <div>
                <Label className="mb-2 block">日期</Label>
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
                      min="1"
                      max="12"
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
                      min="1"
                      max="31"
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

              <div>
                <Label className="mb-2 block">时间</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Input
                      type="number"
                      min="0"
                      max="23"
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
                      min="0"
                      max="59"
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
                      min="0"
                      max="59"
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
            </div>

            <div>
              <Label htmlFor="time-ratio">时间流速</Label>
              <div className="flex items-center gap-2 mt-2">
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
              <p className="text-xs text-muted-foreground mt-1">
                0 = 暂停，1 = 实时，2 = 2倍速
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={jumpMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleTimeJump} disabled={jumpMutation.isPending}>
              {jumpMutation.isPending ? '跳跃中...' : '执行时间跳跃'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 所有时间锚点列表
      <Card>
        <CardHeader>
          <CardTitle>时间锚点历史</CardTitle>
          <CardDescription>所有时间锚点记录</CardDescription>
        </CardHeader>
        <CardContent>
          {anchorsLoading ? (
            <p className="text-muted-foreground text-center py-4">加载中...</p>
          ) : allAnchors.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">暂无时间锚点记录</p>
          ) : (
            <div className="space-y-3">
              {allAnchors.map((anchor) => (
                <div
                  key={anchor.id}
                  className={`p-4 rounded-lg border ${
                    anchor.isCurrent
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-sm text-muted-foreground">
                          #{anchor.id}
                        </span>
                        {anchor.isCurrent && (
                          <Badge variant="default">当前锚点</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">游戏时间: </span>
                          <span className="font-medium">
                            {formatGameTime(anchor.anchorGameTime ? new Date(anchor.anchorGameTime) : null)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">流速: </span>
                          <span className="font-medium">{anchor.timeRatio}x</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">更新时间: </span>
                          <span className="font-medium">
                            {formatTimestamp(anchor.updateTime)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">现实锚点: </span>
                          <span className="font-medium">
                            {formatTimestamp(anchor.anchorRealTime)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card> */}
    </div>
  )
}
