'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { CurrentGameTimeCard } from "@/components/current-game-time-card"
import { useCurrentGameTime } from "@/lib/hooks/use-current-game-time"
import { useTimelineStream } from "@/lib/hooks/use-timeline-stream"
import { useAuth } from "@/lib/contexts/auth-context"
import { useGetMine } from "@/lib/api/endpoints/会议管理/会议管理"
import { useGetLatest } from "@/lib/api/endpoints/时间轴管理/时间轴管理"
import { useDelete } from "@/lib/api/endpoints/消息管理/消息管理"
import type { ConferenceResponse, TimeAnchorResponse, MessageResponse } from "@/lib/api/endpoints/asyaBackendAPI.schemas"
import { TimelineManager } from "@/components/timeline-manager"
import { MessageList, MessageDetailDialog, MessageEditDialog } from "@/components/message"
import { AlertDialogCancel } from "@/components/ui/alert-dialog"
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'

const statusLabels = {
  'PREPARING': '筹备中',
  'RUNNING': '进行中',
  'COMPLETED': '已结束'
}

// 格式化游戏时间为表单输入格式
function formatGameTimeForInput(date: Date | null): string {
  if (!date) return ''
  
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  // 处理负数年份（BC年）
  let displayYear: number
  let era = ''
  
  if (year <= 0) {
    era = 'BC '
    displayYear = 1 - year  // 0→1, -1→2, -420→421
  } else {
    displayYear = year
  }

  return `${era}${displayYear}-${month}-${day} ${hours}:${minutes}`
}

export default function ProgressPage() {
  const queryClient = useQueryClient()
  const { isLoading: authLoading, isAuthenticated } = useAuth()
  const { data: conferenceData, isLoading: conferenceLoading } = useGetMine()
  const { data: latestAnchorData, isLoading: latestLoading } = useGetLatest()
  const { mutate: deleteMessage, isPending: isDeleting } = useDelete()

  const [conference, setConference] = useState<ConferenceResponse | null>(null)
  const [latestAnchor, setLatestAnchor] = useState<TimeAnchorResponse | null>(null)
  
  // 弹窗状态
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState({ title: '', description: '' })
  
  // 消息相关状态
  const [selectedMessageUuid, setSelectedMessageUuid] = useState<string | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingMessage, setEditingMessage] = useState<MessageResponse | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [messageToDelete, setMessageToDelete] = useState<MessageResponse | null>(null)
  
  // 使用共享的 hook 计算当前游戏时间
  const currentGameTime = useCurrentGameTime(latestAnchor)

  // ===== SSE 时间轴订阅功能已禁用 =====
  // // 订阅时间轴事件流
  // useTimelineStream({
  //   enabled: isAuthenticated && !!currentSession,
  //   onTimeJump: (event) => {
  //     console.log('⏭️ 时间跳跃事件:', event)
  //     setAlertMessage({
  //       title: '时间跳跃',
  //       description: '游戏时间发生了跳跃，时间轴已更新',
  //     })
  //     setShowAlert(true)
  //     // 刷新最新锚点数据
  //     refetchLatest()
  //   },
  //   onTimeUpdate: (event) => {
  //     console.log('🔄 时间更新事件:', event)
  //     setAlertMessage({
  //       title: '时间流速变化',
  //       description: '游戏时间流速已调整',
  //     })
  //     setShowAlert(true)
  //     // 刷新最新锚点数据
  //     refetchLatest()
  //   },
  //   onError: (error) => {
  //     console.error('SSE 连接错误:', error)
  //   },
  // })

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

  // 处理点击消息卡片
  const handleMessageClick = (message: MessageResponse) => {
    setSelectedMessageUuid(message.uuid)
    setDetailDialogOpen(true)
  }

  // 处理编辑消息
  const handleEditMessage = (message: MessageResponse) => {
    setEditingMessage(message)
    setEditDialogOpen(true)
  }

  // 处理创建消息
  const handleCreateMessage = () => {
    setEditingMessage(null)
    setEditDialogOpen(true)
  }

  // 处理删除消息
  const handleDeleteMessage = (message: MessageResponse) => {
    setMessageToDelete(message)
    setDeleteDialogOpen(true)
  }

  // 确认删除消息
  const handleConfirmDelete = () => {
    if (!messageToDelete) return
    
    deleteMessage(
      { uuid: messageToDelete.uuid },
      {
        onSuccess: () => {
          toast.success('消息删除成功')
          setDeleteDialogOpen(false)
          setMessageToDelete(null)
          queryClient.invalidateQueries({
            predicate: (query) => {
              const head = query.queryKey[0]
              return typeof head === 'string' && head.startsWith('/api/messages')
            },
          })
        },
        onError: (error) => {
          console.error('删除失败:', error)
          toast.error('消息删除失败，请稍后重试')
          setDeleteDialogOpen(false)
          setMessageToDelete(null)
        }
      }
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 两栏布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：现有内容 */}
        <div className="space-y-6">
        {/* <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">会议进程</h1>
          <p className="text-muted-foreground">查看当前会议和会期状态</p>
        </div> */}

        {/* 当前游戏时间 */}
        <CurrentGameTimeCard 
          currentGameTime={currentGameTime}
          latestAnchor={latestAnchor}
        />

        {/* 时间轴变化提醒弹窗 */}
        <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{alertMessage.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {alertMessage.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setShowAlert(false)}>
                知道了
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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

          </CardContent>
        </Card>
        </div>

        {/* 右侧：消息列表 */}
        <div className="space-y-6">
          {/* <div className="text-center">
            <h2 className="text-4xl font-bold mb-2">消息中心</h2>
            <p className="text-muted-foreground">查看会议相关消息</p>
          </div> */}
          
          <MessageList
            onMessageClick={handleMessageClick}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onCreateMessage={handleCreateMessage}
          />
        </div>
      </div>

      {/* 消息详情弹窗 */}
      <MessageDetailDialog
        messageUuid={selectedMessageUuid}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />

      {/* 消息编辑/创建弹窗 */}
      <MessageEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        message={editingMessage}
        currentGameTime={formatGameTimeForInput(currentGameTime)}
      />

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除消息</AlertDialogTitle>
            <AlertDialogDescription>
              你确定要删除消息「{messageToDelete?.title}」吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
