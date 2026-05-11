'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/lib/contexts/auth-context'
import { useGetSecretMessages } from '@/lib/api/hooks/message'
import { useGetUsers } from '@/lib/api/hooks/conference'
import type { MessageResponse } from '@/lib/api/generated'
import { MessageCard } from './message-card'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE_OPTIONS = ['5', '10', '15', '20']

interface SecretMessageListProps {
  onMessageClick?: (message: MessageResponse) => void
}

export function SecretMessageList({
  onMessageClick,
}: SecretMessageListProps) {
  const { isAuthenticated } = useAuth()
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

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
    },
    {
      query: {
        refetchInterval: 20_000,
        refetchIntervalInBackground: true,
      },
    }
  )

  const messages = data?.content ?? []
  const totalPages = data?.totalPages ?? 0
  const totalElements = data?.totalElements ?? 0
  const currentPageNumber = data?.pageNumber ?? currentPage
  const isFirstPage = data?.isFirstPage ?? currentPageNumber === 0
  const isLastPage = data?.isLastPage ?? (totalPages > 0 ? currentPageNumber >= totalPages - 1 : true)

  const users = usersData ?? []

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {messages.map((message: MessageResponse) => (
              <MessageCard
                key={message.uuid}
                message={message}
                senderDisplayName={message.senderId ? senderDisplayNameMap[message.senderId] : undefined}
                onClick={onMessageClick}
              />
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="text-sm text-muted-foreground">
                第 {currentPageNumber + 1} 页，共 {Math.max(totalPages, 1)} 页，共 {totalElements} 条消息
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="secret-message-page-size" className="text-sm text-muted-foreground">
                  每页
                </Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value))
                    setCurrentPage(0)
                  }}
                >
                  <SelectTrigger id="secret-message-page-size" className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option} 条
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
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
        </>
      )}
    </div>
  )
}
