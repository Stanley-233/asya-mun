import { useEffect, useState } from 'react'
import type { TimeAnchorResponse } from "@/lib/api/endpoints/asyaBackendAPI.schemas"

// 解析包含负数年份的ISO格式时间字符串
function parseGameDateTime(isoString: string): Date {
  // console.log('🔍 [parseGameDateTime] 输入字符串:', isoString)
  
  // 匹配格式: -YYYY-MM-DDTHH:mm:ss 或 YYYY-MM-DDTHH:mm:ss
  const match = isoString.match(/^(-?\d+)-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
  if (!match) {
    console.error('❌ [parseGameDateTime] 无法匹配日期格式:', isoString)
    throw new Error(`Invalid date format: ${isoString}`)
  }
  
  const [, yearStr, month, day, hour, minute, second] = match
  const year = parseInt(yearStr, 10)
  
  // console.log('📅 [parseGameDateTime] 解析结果:', { year, month, day, hour, minute, second })
  
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
  
  // console.log('✅ [parseGameDateTime] 生成的Date对象:', date, 'getFullYear():', date.getFullYear())
  
  return date
}

/**
 * Hook to calculate current game time based on a time anchor
 * @param latestAnchor - The latest time anchor containing game time, real time, and time ratio
 * @returns The current game time as a Date object, or null if not available
 */
export function useCurrentGameTime(latestAnchor: TimeAnchorResponse | null | undefined): Date | null {
  const [currentGameTime, setCurrentGameTime] = useState<Date | null>(null)

  useEffect(() => {
    if (!latestAnchor?.anchorGameTime || !latestAnchor?.anchorRealTime) {
      setCurrentGameTime(null)
      return
    }

    const ratio = latestAnchor.timeRatio ?? 1

    const updateCurrentTime = () => {
      try {
        // 使用专门的解析函数处理可能包含负数年份的游戏时间
        const anchorGameTime = parseGameDateTime(latestAnchor.anchorGameTime!)
        
        // 如果流速为0，时间暂停在锚点时间
        if (ratio === 0) {
          setCurrentGameTime(anchorGameTime)
          return
        }

        const anchorRealTime = new Date(latestAnchor.anchorRealTime!)
        const now = new Date()

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

    // 如果流速为0，不需要定时更新
    if (ratio === 0) {
      return
    }

    // 每秒更新一次
    const interval = setInterval(updateCurrentTime, 1000)

    return () => clearInterval(interval)
  }, [latestAnchor])

  return currentGameTime
}
