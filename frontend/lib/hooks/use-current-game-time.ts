import { useEffect, useMemo, useState } from 'react'
import { parseServerDateTime } from "@/lib/date-time"
import type { TimeAnchorResponse } from "@/lib/api/generated"

// 解析包含负数年份的ISO格式时间字符串
function parseGameDateTime(isoString: string): Date {
  // console.log('🔍 [parseGameDateTime] 输入字符串:', isoString)
  
  // 匹配格式: -YYYY-MM-DDTHH:mm 或 -YYYY-MM-DDTHH:mm:ss(.fff) 或对应正年份
  // 后端 GameTimeString.Format 在秒为 0 时会省略秒部分，因此秒数必须可选
  const match = isoString.match(/^(-?\d+)-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,9}))?$/)
  if (!match) {
    console.error('❌ [parseGameDateTime] 无法匹配日期格式:', isoString)
    throw new Error(`Invalid date format: ${isoString}`)
  }
  
  const [, yearStr, month, day, hour, minute, secondStr, fractionStr] = match
  const year = parseInt(yearStr, 10)
  const second = secondStr ? parseInt(secondStr, 10) : 0
  const millisecond = fractionStr ? parseInt(fractionStr.padEnd(3, '0').slice(0, 3), 10) : 0
  
  // console.log('📅 [parseGameDateTime] 解析结果:', { year, month, day, hour, minute, second })
  
  // JavaScript Date构造函数：new Date(year, monthIndex, day, hour, minute, second, millisecond)
  // 注意：月份是0-based（0-11）
  const date = new Date(
    year,
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10),
    second,
    millisecond
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
  const [currentRealTimeMs, setCurrentRealTimeMs] = useState(() => Date.now())

  useEffect(() => {
    if (!latestAnchor?.anchorGameTime || !latestAnchor?.anchorRealTime) {
      return
    }

    const ratio = latestAnchor.timeRatio ?? 1

    // 如果流速为0，不需要定时更新
    if (ratio === 0) {
      return
    }

    // 每秒更新一次
    const interval = setInterval(() => {
      setCurrentRealTimeMs(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [latestAnchor])

  return useMemo(() => {
    if (!latestAnchor?.anchorGameTime || !latestAnchor?.anchorRealTime) {
      return null
    }

    try {
      const anchorGameTime = parseGameDateTime(latestAnchor.anchorGameTime)
      const ratio = latestAnchor.timeRatio ?? 1

      if (ratio === 0) {
        return anchorGameTime
      }

      const anchorRealTime = parseServerDateTime(latestAnchor.anchorRealTime)
      if (!anchorRealTime) return null
      const timeDiffMs = currentRealTimeMs - anchorRealTime.getTime()
      const gameTimeDiffMs = timeDiffMs * ratio
      return new Date(anchorGameTime.getTime() + gameTimeDiffMs)
    } catch (err) {
      console.error('❌ Failed to calculate current game time:', err)
      return null
    }
  }, [currentRealTimeMs, latestAnchor])
}
