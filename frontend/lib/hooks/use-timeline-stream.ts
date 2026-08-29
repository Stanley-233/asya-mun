export interface TimelineEvent {
  type: 'TIME_JUMP' | 'TIME_UPDATE'
  data?: unknown
}

interface UseTimelineStreamOptions {
  onTimeJump?: (event: TimelineEvent) => void
  onTimeUpdate?: (event: TimelineEvent) => void
  onError?: (error: Error) => void
  enabled?: boolean
}

/**
 * Hook to subscribe to timeline SSE stream using fetch API
 * @param options - Configuration options for the stream
 */
export function useTimelineStream(_options: UseTimelineStreamOptions = {}) {
  void _options
  // ===== SSE 时间轴订阅功能已禁用 =====
  // const {
  //   onTimeJump,
  //   onTimeUpdate,
  //   onError,
  //   enabled = true,
  // } = options

  // const abortControllerRef = useRef<AbortController | null>(null)

  // useEffect(() => {
  //   if (!enabled) {
  //     return
  //   }

  //   const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:5151'
  //   const streamUrl = `${apiBaseUrl}/api/time/stream`

  //   console.log('🔌 [SSE] 连接时间轴事件流:', streamUrl)

  //   const abortController = new AbortController()
  //   abortControllerRef.current = abortController

  //   const connectSSE = async () => {
  //     try {
  //       // 获取token
  //       const token = localStorage.getItem('token')
  //       
  //       const response = await fetch(streamUrl, {
  //         method: 'GET',
  //         headers: {
  //           'Accept': 'text/event-stream',
  //           'Cache-Control': 'no-cache',
  //           ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  //         },
  //         credentials: 'include', // 包含认证信息
  //         signal: abortController.signal,
  //       })

  //       if (!response.ok) {
  //         throw new Error(`SSE connection failed: ${response.status}`)
  //       }

  //       console.log('✅ [SSE] 时间轴事件流已连接')

  //       const reader = response.body?.getReader()
  //       const decoder = new TextDecoder()

  //       if (!reader) {
  //         throw new Error('Response body is not readable')
  //       }

  //       let buffer = ''

  //       while (true) {
  //         const { done, value } = await reader.read()

  //         if (done) {
  //           console.log('🔌 [SSE] 流已结束')
  //           break
  //         }

  //         buffer += decoder.decode(value, { stream: true })
  //         const lines = buffer.split('\n')
  //         buffer = lines.pop() || ''

  //         let currentEvent = ''
  //         let currentData = ''

  //         for (const line of lines) {
  //           if (line.startsWith('event:')) {
  //             currentEvent = line.slice(6).trim()
  //           } else if (line.startsWith('data:')) {
  //             currentData = line.slice(5).trim()
  //           } else if (line === '') {
  //             // 空行表示事件结束
  //             if (currentEvent && currentData) {
  //               handleEvent(currentEvent, currentData)
  //               currentEvent = ''
  //               currentData = ''
  //             }
  //           }
  //         }
  //       }
  //     } catch (error) {
  //       if (error instanceof Error) {
  //         if (error.name === 'AbortError') {
  //           console.log('🔌 [SSE] 连接已取消')
  //         } else {
  //           console.error('❌ [SSE] 连接错误:', error)
  //           onError?.(error)
  //         }
  //       }
  //     }
  //   }

  //   const handleEvent = (eventType: string, data: string) => {
  //     console.log(`📨 [SSE] 收到事件 ${eventType}:`, data)
  //     
  //     try {
  //       const parsedData = data ? JSON.parse(data) : null
  //       
  //       if (eventType === 'TIME_JUMP') {
  //         console.log('⏭️ [SSE] 处理 TIME_JUMP 事件')
  //         onTimeJump?.({ type: 'TIME_JUMP', data: parsedData })
  //       } else if (eventType === 'TIME_UPDATE') {
  //         console.log('🔄 [SSE] 处理 TIME_UPDATE 事件')
  //         onTimeUpdate?.({ type: 'TIME_UPDATE', data: parsedData })
  //       }
  //     } catch (err) {
  //       console.error(`❌ [SSE] 解析事件数据失败:`, err)
  //     }
  //   }

  //   connectSSE()

  //   // 清理函数
  //   return () => {
  //     console.log('🔌 [SSE] 关闭时间轴事件流')
  //     abortController.abort()
  //     abortControllerRef.current = null
  //   }
  // }, [enabled, onTimeJump, onTimeUpdate, onError])

  return {
    abort: () => {}, // abortControllerRef.current?.abort(),
  }
}
