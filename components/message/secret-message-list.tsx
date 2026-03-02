'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/contexts/auth-context'
import { useGetSecretMessages } from '@/lib/api/endpoints/消息管理/消息管理'
import { useGetUsers } from '@/lib/api/endpoints/会议管理/会议管理'
import type { MessageResponse, UserInfoResponse } from '@/lib/api/endpoints/asyaBackendAPI.schemas'
import { MessageCard } from './message-card'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface SecretMessageListProps {
  onMessageClick?: (message: MessageResponse) => void
}

export function SecretMessageList({
  onMessageClick,
}: SecretMessageListProps) {
  const { isAuthenticated } = useAuth()
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(10)

  const { data: usersData } = useGetUsers({
    query: {
      enabled: isAuthenticated,
    },
  })

  const { data, isLoading, error } = useGetSecretMessages(
    {
      pageable: {
        page: currentPage,
        size: pageSize,
        sort: ['publishRealTime,desc'],
      },
    }
  )

  // 解析响应数据
  const parsedData = (() => {
    try {
      if (!data) return null
      const responseData = (data as any).data
      if (!responseData) return null
      
      const parsed = typeof responseData === 'string' 
        ? JSON.parse(responseData) 
        : responseData
      
      return parsed.data || parsed
    } catch (err) {
      console.error('Failed to parse secret message data:', err)
      return null
    }
  })()

  const messages = parsedData?.content || []
  const totalPages = parsedData?.totalPages || 0
  const isFirstPage = parsedData?.first ?? true
  const isLastPage = parsedData?.last ?? true

  const users: UserInfoResponse[] = (() => {
    try {
      if (!usersData) return []
      const responseData = (usersData as any).data
      if (!responseData) return []

      const parsed = typeof responseData === 'string'
        ? JSON.parse(responseData)
        : responseData

      const usersList = parsed.data || parsed
      return Array.isArray(usersList) ? usersList : []
    } catch (err) {
      console.error('Failed to parse users data:', err)
      return []
    }
  })()

  const senderDisplayNameMap = users.reduce<Record<string, string>>((acc, user) => {
    const displayName = user.displayName?.trim()
    const label = displayName || user.name || ''
    if (user.uuid && label) {
      acc[user.uuid] = label
    }
    return acc
  }, {})

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        加载非对称消息失败，请稍后重试
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          加载中...
        </div>
      )}

      {/* Empty State */}
      {!isLoading && messages.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <p className="text-lg">暂无非对称消息</p>
          <p className="text-sm mt-2">您接收的私密消息将显示在这里</p>
        </div>
      )}

      {/* Message List */}
      {!isLoading && messages.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4">
            {messages.map((message: MessageResponse) => (
              <MessageCard
                key={message.uuid}
                message={message}
                senderDisplayName={message.senderId ? senderDisplayNameMap[message.senderId] : undefined}
                onClick={onMessageClick}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-sm text-muted-foreground">
                第 {currentPage + 1} 页，共 {totalPages} 页
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p - 1)}
                  disabled={isFirstPage}
                >
                  <ChevronLeft />
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={isLastPage}
                >
                  下一页
                  <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
