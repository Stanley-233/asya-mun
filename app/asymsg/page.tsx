'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/contexts/auth-context"
import { useGetAllSecretInConference, useDelete } from "@/lib/api/endpoints/消息管理/消息管理"
import { useGetUsers } from "@/lib/api/endpoints/会议管理/会议管理"
import type { MessageResponse, UserInfoResponse } from "@/lib/api/endpoints/asyaBackendAPI.schemas"
import { MessageCard } from '@/components/message/message-card'
import { MessageEditDialog } from '@/components/message/message-edit-dialog'
import { MessageDetailDialog } from '@/components/message/message-detail-dialog'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'

const msgTypeLabels = {
  'EVENT': '事件',
  'NEWS': '新闻',
  'CRISIS': '危机',
  'WAR_REPORT': '战报',
  'SECRET_LETTER': '密函'
}

export default function DirectiveAsymsgPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  
  // 检查用户权限
  const canManageMessages = user?.role === 'DM' || user?.role === 'DH' || user?.role === 'SYS_ADMIN'
  
  // 表单输入状态（用户正在输入的值）
  const [formSenderId, setFormSenderId] = useState<string>('')
  const [formReceiverId, setFormReceiverId] = useState<string>('')
  const [formKeyword, setFormKeyword] = useState<string>('')
  
  // 实际查询参数（点击搜索后才更新）
  const [senderId, setSenderId] = useState<string>('')
  const [receiverId, setReceiverId] = useState<string>('')
  const [keyword, setKeyword] = useState<string>('')
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(10)
  const [pageIndexBase, setPageIndexBase] = useState<0 | 1>(0)
  
  // 对话框状态
  const [selectedMessageUuid, setSelectedMessageUuid] = useState<string | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<MessageResponse | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [messageToDelete, setMessageToDelete] = useState<MessageResponse | null>(null)
  
  // 获取用户列表
  const { data: usersData, isLoading: usersLoading } = useGetUsers({
    query: {
      enabled: isAuthenticated && canManageMessages,
    }
  })
  
  const requestPage = currentPage + pageIndexBase

  // 获取非对称消息列表
  const { data: messagesData, isLoading: messagesLoading, refetch } = useGetAllSecretInConference(
    {
      senderId: senderId || undefined,
      receiverId: receiverId || undefined,
      keyword: keyword || undefined,
      pageable: {
        page: requestPage,
        size: pageSize,
        sort: ['publishRealTime,desc'],
      },
    },
    {
      query: {
        enabled: isAuthenticated && canManageMessages,
      }
    }
  )
  
  // 删除消息
  const { mutate: deleteMessage, isPending: isDeleting } = useDelete()
  
  // 解析用户数据
  const users: UserInfoResponse[] = (() => {
    try {
      if (!usersData) return []
      const responseData = (usersData as any).data
      if (!responseData) return []
      
      const parsedData = typeof responseData === 'string'
        ? JSON.parse(responseData)
        : responseData
      
      const usersList = parsedData.data || parsedData
      return Array.isArray(usersList) ? usersList : []
    } catch (err) {
      console.error('Failed to parse users data:', err)
      return []
    }
  })()

  const getUserLabel = (targetUser: UserInfoResponse) => {
    const displayName = targetUser.displayName?.trim()
    return displayName ? `${displayName}（${targetUser.name}）` : targetUser.name
  }
  
  // 解析消息数据
  const parsedMessagesData = (() => {
    try {
      if (!messagesData) return null
      const responseData = (messagesData as any).data
      if (!responseData) return null
      
      const parsed = typeof responseData === 'string'
        ? JSON.parse(responseData)
        : responseData
      
      return parsed.data || parsed
    } catch (err) {
      console.error('Failed to parse messages data:', err)
      return null
    }
  })()
  
  const messages = parsedMessagesData?.content || []
  const rawTotalPages =
    parsedMessagesData?.totalPages ??
    parsedMessagesData?.totalPage ??
    parsedMessagesData?.page?.totalPages ??
    0
  const totalElements =
    parsedMessagesData?.totalElements ??
    parsedMessagesData?.total ??
    parsedMessagesData?.page?.totalElements ??
    0
  const sizeFromApi =
    parsedMessagesData?.size ??
    parsedMessagesData?.pageable?.pageSize ??
    parsedMessagesData?.page?.size
  const computedTotalPages =
    rawTotalPages && rawTotalPages > 0
      ? rawTotalPages
      : totalElements && sizeFromApi
        ? Math.ceil(totalElements / sizeFromApi)
        : 0
  const totalPages = computedTotalPages
  const pageNumber =
    parsedMessagesData?.number ??
    parsedMessagesData?.pageable?.pageNumber ??
    parsedMessagesData?.page?.number
  const isFirstPage =
    parsedMessagesData?.first ??
    (typeof pageNumber === 'number' ? pageNumber <= 0 : true)
  const isLastPage =
    parsedMessagesData?.last ??
    (typeof pageNumber === 'number' && totalPages > 0
      ? pageNumber >= totalPages - 1
      : true)

  useEffect(() => {
    if (!parsedMessagesData) return
    if (typeof pageNumber !== 'number') return
    if (currentPage !== 0) return
    setPageIndexBase(pageNumber === 0 ? 0 : 1)
  }, [parsedMessagesData, pageNumber, currentPage])

  useEffect(() => {
    if (!messagesData) return
    console.log('[asymsg] messagesData raw:', messagesData)
    console.log('[asymsg] parsedMessagesData:', parsedMessagesData)
    console.log('[asymsg] pagination:', {
      currentPage,
      requestPage,
      pageSize,
      totalPages,
      totalElements,
      rawTotalPages,
      sizeFromApi,
      pageNumber,
      isFirstPage,
      isLastPage,
      contentLength: messages.length,
    })
  }, [messagesData])

  useEffect(() => {
    if (!parsedMessagesData) return
    if (totalPages === 0 && currentPage !== 0) {
      setCurrentPage(0)
      return
    }
    if (totalPages > 0 && currentPage > totalPages - 1) {
      setCurrentPage(totalPages - 1)
    }
  }, [parsedMessagesData, totalPages, currentPage])
  
  // 权限检查
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !canManageMessages)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, canManageMessages, router])
  
  // 处理搜索
  const handleSearch = () => {
    // 将表单值复制到查询参数
    setSenderId(formSenderId)
    setReceiverId(formReceiverId)
    setKeyword(formKeyword)
    setCurrentPage(0)
  }
  
  // 清空筛选
  const handleClearFilters = () => {
    // 清空表单和查询参数
    setFormSenderId('')
    setFormReceiverId('')
    setFormKeyword('')
    setSenderId('')
    setReceiverId('')
    setKeyword('')
    setCurrentPage(0)
  }
  
  // 消息点击处理
  const handleMessageClick = (message: MessageResponse) => {
    setSelectedMessageUuid(message.uuid)
    setIsDetailDialogOpen(true)
  }
  
  // 编辑消息
  const handleEditMessage = (message: MessageResponse) => {
    setSelectedMessage(message)
    setIsEditDialogOpen(true)
  }
  
  // 删除消息
  const handleDeleteMessage = (message: MessageResponse) => {
    setMessageToDelete(message)
    setIsDeleteDialogOpen(true)
  }
  
  // 确认删除消息
  const handleConfirmDelete = () => {
    if (!messageToDelete) return
    
    deleteMessage(
      { uuid: messageToDelete.uuid },
      {
        onSuccess: () => {
          toast.success('消息删除成功')
          setIsDeleteDialogOpen(false)
          setMessageToDelete(null)
          queryClient.invalidateQueries({ queryKey: ['/api/messages'] })
          queryClient.invalidateQueries({ queryKey: ['/api/messages/secret/conference'] })
          refetch()
        },
        onError: (error) => {
          console.error('删除失败:', error)
          toast.error('消息删除失败，请稍后重试')
          setIsDeleteDialogOpen(false)
          setMessageToDelete(null)
        }
      }
    )
  }
  
  // 编辑对话框关闭后刷新列表
  const handleEditDialogClose = (open: boolean) => {
    setIsEditDialogOpen(open)
    if (!open) {
      // 延迟清空选中的消息，确保对话框已完全关闭
      setTimeout(() => setSelectedMessage(null), 100)
      refetch()
    }
  }
  
  if (authLoading || messagesLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-screen">
          <p className="text-lg text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }
  
  if (!canManageMessages) {
    return null
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>非对称消息管理</CardTitle>
            <CardDescription>查看和管理本会议的所有非对称消息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 筛选区域 */}
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold text-sm">筛选条件</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 发送者筛选 */}
                <div>
                  <Label htmlFor="sender">发送者</Label>
                  <select
                    id="sender"
                    value={formSenderId}
                    onChange={(e) => setFormSenderId(e.target.value)}
                    className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 mt-2"
                  >
                    <option value="">全部发送者</option>
                    {users.map(user => (
                      <option key={user.uuid} value={user.uuid}>
                        {getUserLabel(user)}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* 接收者筛选 */}
                <div>
                  <Label htmlFor="receiver">接收者</Label>
                  <select
                    id="receiver"
                    value={formReceiverId}
                    onChange={(e) => setFormReceiverId(e.target.value)}
                    className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 mt-2"
                  >
                    <option value="">全部接收者</option>
                    {users.map(user => (
                      <option key={user.uuid} value={user.uuid}>
                        {getUserLabel(user)}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* 关键词筛选 */}
                <div>
                  <Label htmlFor="keyword">标题关键词</Label>
                  <Input
                    id="keyword"
                    type="text"
                    placeholder="搜索标题..."
                    value={formKeyword}
                    onChange={(e) => setFormKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch()
                      }
                    }}
                    className="mt-2"
                  />
                </div>
              </div>
              
              {/* 操作按钮 */}
              <div className="flex gap-2">
                <Button onClick={handleSearch} size="sm">
                  <Search className="w-4 h-4" />
                  搜索
                </Button>
                <Button 
                  onClick={handleClearFilters} 
                  variant="outline" 
                  size="sm"
                  disabled={!formSenderId && !formReceiverId && !formKeyword}
                >
                  <X className="w-4 h-4" />
                  清空筛选
                </Button>
              </div>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t pt-4">
                <div className="text-sm text-muted-foreground">
                  第 {currentPage + 1} 页，共 {totalPages} 页
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    disabled={isFirstPage}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={isLastPage}
                  >
                    下一页
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            
            {/* 消息列表 */}
            {messagesLoading ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                加载中...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <p className="text-lg">暂无非对称消息</p>
                <p className="text-sm mt-2">当前筛选条件下没有找到消息</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {messages.map((message: MessageResponse) => (
                    <MessageCard
                      key={message.uuid}
                      message={message}
                      onClick={handleMessageClick}
                      onEdit={handleEditMessage}
                      onDelete={handleDeleteMessage}
                    />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* 消息详情对话框 */}
      <MessageDetailDialog
        messageUuid={selectedMessageUuid}
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
      />
      
      {/* 消息编辑对话框 */}
      <MessageEditDialog
        open={isEditDialogOpen}
        onOpenChange={handleEditDialogClose}
        message={selectedMessage}
      />
      
      {/* 删除确认对话框 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
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
