'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CurrentGameTimeCard } from "@/components/current-game-time-card"
import { useCurrentGameTime } from "@/lib/hooks/use-current-game-time"
import { useAuth } from "@/lib/contexts/auth-context"
import { useGetMine, useGetCurrentSession } from "@/lib/api/endpoints/会议管理/会议管理"
import { useGetLatest } from "@/lib/api/endpoints/时间轴管理/时间轴管理"
import type { ConferenceResponse, ConferenceSessionResponse, TimeAnchorResponse } from "@/lib/api/endpoints/asyaBackendAPI.schemas"
import { TimelineManager } from "@/components/timeline-manager"

const statusLabels = {
  'PREPARING': '筹备中',
  'RUNNING': '进行中',
  'COMPLETED': '已结束'
}

const sessionStatusLabels = {
  'PREPARE': '准备中',
  'RUNNING': '进行中',
  'PAUSED': '暂停',
  'ENDED': '已结束'
}

export default function ProgressPage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth()
  const { data: conferenceData, isLoading: conferenceLoading } = useGetMine()
  const { data: currentSessionData, isLoading: sessionLoading } = useGetCurrentSession()
  const { data: latestAnchorData, isLoading: latestLoading } = useGetLatest()

  const [conference, setConference] = useState<ConferenceResponse | null>(null)
  const [currentSession, setCurrentSession] = useState<ConferenceSessionResponse | null>(null)
  const [latestAnchor, setLatestAnchor] = useState<TimeAnchorResponse | null>(null)
  
  // 使用共享的 hook 计算当前游戏时间
  const currentGameTime = useCurrentGameTime(latestAnchor)

  useEffect(() => {
    if (conferenceData && !conferenceLoading) {
      try {
        const responseData = (conferenceData as any).data
        if (responseData) {
          const parsedData = typeof responseData === 'string' 
            ? JSON.parse(responseData) 
            : responseData
          
          const conferenceInfo = parsedData.data || parsedData
          setConference(conferenceInfo)
        }
      } catch (err) {
        console.error('Failed to parse conference data:', err)
        setConference(null)
      }
    }
  }, [conferenceData, conferenceLoading])

  useEffect(() => {
    if (currentSessionData && !sessionLoading) {
      try {
        const responseData = (currentSessionData as any).data
        if (responseData) {
          const parsedData = typeof responseData === 'string'
            ? JSON.parse(responseData)
            : responseData

          const sessionInfo = parsedData.data || parsedData
          setCurrentSession(sessionInfo)
        }
      } catch (err) {
        console.error('Failed to parse session data:', err)
        setCurrentSession(null)
      }
    }
  }, [currentSessionData, sessionLoading])

  // 解析最新锚点数据
  useEffect(() => {
    if (latestAnchorData && !latestLoading) {
      try {
        const responseData = (latestAnchorData as any).data
        if (responseData) {
          const parsedData = typeof responseData === 'string'
            ? JSON.parse(responseData)
            : responseData

          const anchor = parsedData.data || null
          setLatestAnchor(anchor)
        }
      } catch (err) {
        console.error('Failed to parse latest anchor data:', err)
        setLatestAnchor(null)
      }
    }
  }, [latestAnchorData, latestLoading])

  if (authLoading || conferenceLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-screen">
          <p className="text-lg text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-screen">
          <p className="text-lg text-muted-foreground">请先登录</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">会议进程</h1>
          <p className="text-muted-foreground">查看当前会议和会期状态</p>
        </div>

        {/* 当前游戏时间 */}
        <CurrentGameTimeCard 
          currentGameTime={currentGameTime}
          latestAnchor={latestAnchor}
        />

        {/* 当前会议和会期合并卡片 */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl">当前会议进程</CardTitle>
            <CardDescription>实时会议和会期信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 当前会议信息 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-muted-foreground">当前会议</h3>
                {conference && (
                  <Badge 
                    variant={conference.status === 'RUNNING' ? 'default' : 'secondary'}
                    className="text-sm px-3 py-1"
                  >
                    {statusLabels[conference.status as keyof typeof statusLabels] || conference.status}
                  </Badge>
                )}
              </div>
              {!conference ? (
                <div className="bg-muted/50 p-6 rounded-lg text-center">
                  <p className="text-muted-foreground">当前没有关联的会议</p>
                </div>
              ) : (
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="text-xl font-bold mb-2">{conference.name}</h4>
                  <p className="text-muted-foreground">{conference.description}</p>
                </div>
              )}
            </div>

            {/* 分割线 */}
            <div className="border-t"></div>

            {/* 当前会期信息 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-muted-foreground">当前会期</h3>
                {currentSession && (
                  <Badge 
                    variant={currentSession.status === 'RUNNING' ? 'default' : 'secondary'}
                    className={`text-sm px-3 py-1 ${
                      currentSession.status === 'RUNNING'
                        ? 'bg-green-600 hover:bg-green-700'
                        : currentSession.status === 'PAUSED'
                        ? 'bg-yellow-600 hover:bg-yellow-700'
                        : currentSession.status === 'ENDED'
                        ? 'bg-gray-600 hover:bg-gray-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {sessionStatusLabels[currentSession.status as keyof typeof sessionStatusLabels] || currentSession.status}
                  </Badge>
                )}
              </div>
              {sessionLoading ? (
                <div className="bg-muted/50 p-6 rounded-lg text-center">
                  <p className="text-muted-foreground">加载中...</p>
                </div>
              ) : !currentSession ? (
                <div className="bg-muted/50 p-6 rounded-lg text-center">
                  <p className="text-muted-foreground">当前没有进行中的会期</p>
                  <p className="text-sm text-muted-foreground mt-2">请等待会议管理员设置当前会期</p>
                </div>
              ) : (
                <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                  <h4 className="text-xl font-bold mb-2">{currentSession.name}</h4>
                  {currentSession.description && (
                    <p className="text-muted-foreground">{currentSession.description}</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 信息提示 */}
        {/* <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                i
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">关于会议进程</h4>
                <p className="text-sm text-blue-800">
                  此页面显示当前会议和会期的实时状态。会期状态由会议管理员控制，会根据会议进展自动更新。
                  请随时关注当前会期状态，以了解会议的最新进展。
                </p>
              </div>
            </div>
          </CardContent>
        </Card> */}
      </div>
    </div>
  )
}
