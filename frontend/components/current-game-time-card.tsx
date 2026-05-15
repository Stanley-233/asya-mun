'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface CurrentGameTimeCardProps {
  currentGameTime: Date | null
  latestAnchor?: {
    timeRatio?: number
    updateTime?: string
  } | null
}

// 格式化会议次元时间显示
// JavaScript Date遵循ISO 8601: 0年=BC1, -1年=BC2, -420年=BC421
function formatGameTime(date: Date | null): string {
  if (!date) return '未知'
  
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  const era = year <= 0 ? 'BC ' : ''
  const displayYear = year <= 0 ? 1 - year : year

  return `${era}${displayYear}/${month}/${day} ${hours}:${minutes}:${seconds}`
}

// 格式化时间戳
function formatTimestamp(timestamp: string | undefined): string {
  if (!timestamp) return '未知'
  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return '未知'
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    const s = String(date.getSeconds()).padStart(2, '0')
    return `${y}/${m}/${d} ${h}:${min}:${s}`
  } catch {
    return '未知'
  }
}

export function CurrentGameTimeCard({ currentGameTime, latestAnchor }: CurrentGameTimeCardProps) {
  return (
    <Card className="border-2 border-primary">
      <CardHeader>
        <CardTitle className="text-2xl">当前会议次元时间</CardTitle>
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
  )
}
