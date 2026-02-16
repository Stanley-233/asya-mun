'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/contexts/auth-context'
import { useGetAll } from '@/lib/api/endpoints/消息管理/消息管理'
import { useGetUsers } from '@/lib/api/endpoints/会议管理/会议管理'
import type { MessageResponse, UserInfoResponse } from '@/lib/api/endpoints/asyaBackendAPI.schemas'
import { MessageCard } from './message-card'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'

interface MessageListProps {
  onMessageClick?: (message: MessageResponse) => void
  onEditMessage?: (message: MessageResponse) => void
  onDeleteMessage?: (message: MessageResponse) => void
  onCreateMessage?: () => void
}

export function MessageList({
  onMessageClick,
  onEditMessage,
  onDeleteMessage,
  onCreateMessage,
}: MessageListProps) {
  const { canManageConference, isAuthenticated } = useAuth()
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(10)

  const { data: usersData } = useGetUsers({
    query: {
      enabled: isAuthenticated,
    },
  })

  const { data, isLoading, error } = useGetAll(
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
      if (!data) {
        console.log('⚠️ data 为空')
        return null
      }
      
      console.log('📦 完整响应数据:', data)
      
      const responseData = (data as any).data
      if (!responseData) {
        console.log('⚠️ responseData 为空')
        return null
      }
      
      console.log('📦 responseData 类型:', typeof responseData)
      console.log('📦 responseData 内容:', responseData)
      
      const parsed = typeof responseData === 'string' 
        ? JSON.parse(responseData) 
        : responseData
      
      console.log('📦 parsed 结构:', parsed)
      console.log('📦 parsed.data 存在?', !!parsed.data)
      
      const finalData = parsed.data || parsed
      console.log('📦 最终分页数据:', finalData)
      console.log('📦 totalPages:', finalData?.totalPages || finalData?.page?.totalPages)
      console.log('📦 totalElements:', finalData?.totalElements || finalData?.page?.totalElements)
      console.log('📦 content length:', finalData?.content?.length)
      
      return finalData
    } catch (err) {
      console.error('❌ 解析消息数据失败:', err)
      return null
    }
  })()

  const messages = parsedData?.content || []
  // 支持两种分页数据结构：Spring Boot 默认格式 (page 对象) 和扁平格式
  const totalPages = parsedData?.totalPages || parsedData?.page?.totalPages || 0
  const totalElements = parsedData?.totalElements || parsedData?.page?.totalElements || 0
  const currentPageNumber = parsedData?.number ?? parsedData?.page?.number ?? currentPage
  const isFirstPage = currentPageNumber === 0
  const isLastPage = totalPages > 0 ? currentPageNumber >= totalPages - 1 : true
  
  console.log(`📄 分页信息: 当前页=${currentPage}, 页码=${currentPageNumber}, 总页数=${totalPages}, 总消息数=${totalElements}, 当前页消息数=${messages.length}`)

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
        加载消息失败，请稍后重试
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">消息列表</h2>
        {canManageConference && onCreateMessage && (
          <Button onClick={onCreateMessage} size="sm">
            <Plus />
            创建消息
          </Button>
        )}
      </div>

      {/* Pagination - 标题下方 */}
      {!isLoading && messages.length > 0 && (
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">
            {totalPages > 0 ? (
              <>第 {currentPage + 1} 页，共 {totalPages} 页 · 共 {totalElements} 条消息</>
            ) : (
              <>共 {messages.length} 条消息</>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={isFirstPage || currentPage === 0}
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

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          加载中...
        </div>
      )}

      {/* Empty State */}
      {!isLoading && messages.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <p className="text-lg">暂无消息</p>
          {canManageConference && (
            <p className="text-sm mt-2">点击上方按钮创建第一条消息</p>
          )}
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
                onEdit={onEditMessage}
                onDelete={onDeleteMessage}
              />
            ))}
          </div>

        </>
      )}
    </div>
  )
}
