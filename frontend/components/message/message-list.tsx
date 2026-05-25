'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/lib/contexts/auth-context'
import { useGetAll } from '@/lib/api/hooks/message'
import type { MessageResponse } from '@/lib/api/generated'
import { MessageCard } from './message-card'
import { Plus, ChevronLeft, ChevronRight, X } from 'lucide-react'

const PAGE_SIZE_OPTIONS = ['5', '10', '15', '20']

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
  const { canManageConference } = useAuth()
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [formKeyword, setFormKeyword] = useState('')

  const handleSearch = () => {
    setKeyword(formKeyword.trim())
    setCurrentPage(0)
  }

  const { data, isLoading, error } = useGetAll(
    {
      keyword: keyword.trim() || undefined,
      pageable: {
        page: currentPage,
        size: pageSize,
        sort: ['publishRealTime,desc'],
      },
    }
  )

  const messages = data?.content ?? []
  const totalPages = data?.totalPages ?? 0
  const totalElements = data?.totalElements ?? 0
  const currentPageNumber = data?.pageNumber ?? currentPage
  const isFirstPage = currentPageNumber === 0
  const isLastPage = totalPages > 0 ? currentPageNumber >= totalPages - 1 : true

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="message-keyword">标题 / 内容关键词</Label>
          <Input
            id="message-keyword"
            value={formKeyword}
            onChange={(event) => setFormKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleSearch()
              }
            }}
            placeholder="输入关键词搜索标题或内容"
          />
        </div>
        <Button onClick={handleSearch}>
          查询
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setKeyword('')
            setFormKeyword('')
            setCurrentPage(0)
          }}
          disabled={!keyword && !formKeyword}
        >
          <X />
          清空
        </Button>
      </div>

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
                onClick={onMessageClick}
                onEdit={onEditMessage}
                onDelete={onDeleteMessage}
              />
            ))}
          </div>
          <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="text-sm text-muted-foreground">
                第 {currentPageNumber + 1} 页，共 {Math.max(totalPages, 1)} 页，共 {totalElements} 条消息
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="message-page-size" className="text-sm text-muted-foreground">
                  每页
                </Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value))
                    setCurrentPage(0)
                  }}
                >
                  <SelectTrigger id="message-page-size" className="w-[110px]">
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
