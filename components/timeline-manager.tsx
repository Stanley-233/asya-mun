'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useGetAll, useGetLatest, useJump, useUpdate1 } from "@/lib/api/endpoints/时间轴管理/时间轴管理"
import type { TimeAnchorResponse, ConferenceSessionResponse } from "@/lib/api/endpoints/asyaBackendAPI.schemas"

interface TimelineManagerProps {
  currentSession: ConferenceSessionResponse | null
}

// 游戏开始时间：公元前450年1月1日
const GAME_START_DATE = new Date(-450, 0, 1)

// 解析包含负数年份的ISO格式时间字符串
function parseGameDateTime(isoString: string): Date {
  console.log('🔍 [parseGameDateTime] 输入字符串:', isoString)
  
  // 匹配格式: -YYYY-MM-DDTHH:mm:ss 或 YYYY-MM-DDTHH:mm:ss
  const match = isoString.match(/^(-?\d+)-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
  if (!match) {
    console.error('❌ [parseGameDateTime] 无法匹配日期格式:', isoString)
    throw new Error(`Invalid date format: ${isoString}`)
  }
  
  const [, yearStr, month, day, hour, minute, second] = match
  const year = parseInt(yearStr, 10)
  
  console.log('📅 [parseGameDateTime] 解析结果:', { year, month, day, hour, minute, second })
  
  // JavaScript Date构造函数：new Date(year, monthIndex, day, hour, minute, second)
  // 注意：月份是0-based（0-11）
  const date = new Date(
    year,
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10),
    parseInt(second, 10)
  )
  
  console.log('✅ [parseGameDateTime] 生成的Date对象:', date, 'getFullYear():', date.getFullYear())
  
  return date
}

export function TimelineManager({ currentSession }: TimelineManagerProps) {
  const { data: allAnchorsData, isLoading: anchorsLoading, refetch: refetchAnchors } = useGetAll()
  const { data: latestAnchorData, isLoading: latestLoading, refetch: refetchLatest } = useGetLatest()
  const jumpMutation = useJump()
  const updateMutation = useUpdate1()

  const [allAnchors, setAllAnchors] = useState<TimeAnchorResponse[]>([])
  const [latestAnchor, setLatestAnchor] = useState<TimeAnchorResponse | null>(null)
  const [currentGameTime, setCurrentGameTime] = useState<Date | null>(null)

  // 时间跳跃表单状态
  const [targetYear, setTargetYear] = useState<number>(-450)
  const [targetMonth, setTargetMonth] = useState<number>(1)
  const [targetDay, setTargetDay] = useState<number>(1)
  const [targetHour, setTargetHour] = useState<number>(0)
  const [targetMinute, setTargetMinute] = useState<number>(0)
  const [targetSecond, setTargetSecond] = useState<number>(0)
  const [timeRatio, setTimeRatio] = useState<number>(1)

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

  // 本地计算当前游戏时间
  useEffect(() => {
    if (!latestAnchor?.anchorGameTime || !latestAnchor?.anchorRealTime) {
      setCurrentGameTime(null)
      return
    }

    const updateCurrentTime = () => {
      try {
        // 使用专门的解析函数处理可能包含负数年份的游戏时间
        const anchorGameTime = parseGameDateTime(latestAnchor.anchorGameTime!)
        const anchorRealTime = new Date(latestAnchor.anchorRealTime!)
        const now = new Date()
        const ratio = latestAnchor.timeRatio || 1

        // 当前游戏时间 = 锚点游戏时间 + (当前现实时间 - 锚点现实时间) × 流速
        const timeDiffMs = now.getTime() - anchorRealTime.getTime()
        const gameTimeDiffMs = timeDiffMs * ratio
        const calculatedGameTime = new Date(anchorGameTime.getTime() + gameTimeDiffMs)

        setCurrentGameTime(calculatedGameTime)
      } catch (err) {
        console.error('❌ Failed to calculate current game time:', err)
        setCurrentGameTime(null)
      }
    }

    // 初始计算
    updateCurrentTime()

    // 每秒更新一次
    const interval = setInterval(updateCurrentTime, 1000)

    return () => clearInterval(interval)
  }, [latestAnchor])

  // 处理时间跳跃
  const handleTimeJump = async () => {
    if (!currentSession?.uuid) {
      alert('请先选择当前会期')
      return
    }

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
        timeRatio,
        sessionId: currentSession.uuid
      })

      await jumpMutation.mutateAsync({
        data: {
          sessionId: currentSession.uuid,
          targetGameTime,
          timeRatio
        }
      })

      console.log('✅ [时间跳跃] 提交成功')
      alert('时间跳跃成功')
      // 刷新数据
      refetchAnchors()
      refetchLatest()
    } catch (err) {
      console.error('Time jump failed:', err)
      alert('时间跳跃失败')
    }
  }

  // 处理时间轴更新（启动/恢复/变速）
  const handleTimeUpdate = async (newRatio: number) => {
    if (!currentSession?.uuid) {
      alert('请先选择当前会期')
      return
    }

    try {
      await updateMutation.mutateAsync({
        data: {
          sessionId: currentSession.uuid,
          timeRatio: newRatio
        }
      })

      alert(`时间流速已调整为 ${newRatio}x`)
      // 刷新数据
      refetchAnchors()
      refetchLatest()
    } catch (err) {
      console.error('Time update failed:', err)
      alert('时间轴更新失败')
    }
  }

  // 格式化游戏时间显示
  const formatGameTime = (date: Date | null) => {
    if (!date) return '未知'
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    const era = year < 0 ? 'BC' : 'AD'
    const absYear = Math.abs(year)

    return `${era} ${absYear}年${month}月${day}日 ${hours}:${minutes}:${seconds}`
  }

  // 格式化时间戳
  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return '未知'
    try {
      const date = new Date(timestamp)
      return date.toLocaleString('zh-CN')
    } catch {
      return '未知'
    }
  }

  if (!currentSession) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>时间轴管理</CardTitle>
          <CardDescription>管理游戏时间流动</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            请先选择当前会期才能管理时间轴
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 当前游戏时间显示 */}
      <Card className="border-2 border-primary">
        <CardHeader>
          <CardTitle className="text-2xl">当前游戏时间</CardTitle>
          <CardDescription>基于最新锚点的实时计算</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">
              {formatGameTime(currentGameTime)}
            </div>
            {latestAnchor && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p>时间流速: {latestAnchor.timeRatio}x</p>
                <p>最新锚点更新: {formatTimestamp(latestAnchor.updateTime)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 时间跳跃控制 */}
      <Card>
        <CardHeader>
          <CardTitle>时间跨度跳跃</CardTitle>
          <CardDescription>快进或回溯到指定游戏时间</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="target-year">年份</Label>
                <Input
                  id="target-year"
                  type="number"
                  value={targetYear}
                  onChange={(e) => setTargetYear(parseInt(e.target.value) || 0)}
                  placeholder="例: -450"
                />
                <p className="text-xs text-muted-foreground mt-1">负数表示公元前</p>
              </div>
              <div>
                <Label htmlFor="target-month">月份</Label>
                <Input
                  id="target-month"
                  type="number"
                  min="1"
                  max="12"
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <Label htmlFor="target-day">日期</Label>
                <Input
                  id="target-day"
                  type="number"
                  min="1"
                  max="31"
                  value={targetDay}
                  onChange={(e) => setTargetDay(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="target-hour">时</Label>
                <Input
                  id="target-hour"
                  type="number"
                  min="0"
                  max="23"
                  value={targetHour}
                  onChange={(e) => setTargetHour(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label htmlFor="target-minute">分</Label>
                <Input
                  id="target-minute"
                  type="number"
                  min="0"
                  max="59"
                  value={targetMinute}
                  onChange={(e) => setTargetMinute(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label htmlFor="target-second">秒</Label>
                <Input
                  id="target-second"
                  type="number"
                  min="0"
                  max="59"
                  value={targetSecond}
                  onChange={(e) => setTargetSecond(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
          
          <div>
            <Label htmlFor="time-ratio">时间流速</Label>
            <Input
              id="time-ratio"
              type="number"
              step="0.1"
              min="0"
              value={timeRatio}
              onChange={(e) => setTimeRatio(parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              1.0 = 实时, 2.0 = 2倍速, 0 = 暂停
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleTimeJump}
              disabled={jumpMutation.isPending}
              className="flex-1"
            >
              {jumpMutation.isPending ? '跳跃中...' : '执行时间跳跃'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setTargetYear(-450)
                setTargetMonth(1)
                setTargetDay(1)
                setTargetHour(0)
                setTargetMinute(0)
                setTargetSecond(0)
              }}
            >
              重置为游戏开始
            </Button>
          </div>

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

      {/* 所有时间锚点列表 */}
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
      </Card>
    </div>
  )
}
