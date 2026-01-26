'use client'

import { useState, useEffect } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useCreate1, useUpdate } from '@/lib/api/endpoints/消息管理/消息管理'
import type {
  MessageResponse,
  MessageCreateRequest,
  MessageUpdateRequest,
} from '@/lib/api/endpoints/asyaBackendAPI.schemas'
import { useQueryClient } from '@tanstack/react-query'

interface MessageEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message?: MessageResponse | null
  sessionId?: string
  currentGameTime?: string
}

const MSG_TYPE_OPTIONS = [
  { value: 'EVENT', label: '事件' },
  { value: 'NEWS', label: '新闻' },
  { value: 'CRISIS', label: '危机' },
]

// 将友好格式转换为ISO 8601格式
// "BC 454-12-31 20:20" -> "-0453-12-31T20:20:00"
// "2024-01-15 10:00" -> "2024-01-15T10:00:00"
function parseGameTimeToISO(gameTimeStr: string): string {
  if (!gameTimeStr) return ''
  
  // 匹配 BC 格式: "BC 454-12-31 20:20"
  const bcMatch = gameTimeStr.match(/^BC\s+(\d+)-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/)
  if (bcMatch) {
    const [, year, month, day, hour, minute] = bcMatch
    const isoYear = -(parseInt(year, 10) - 1) // BC 454 -> -453
    const yearStr = Math.abs(isoYear).toString().padStart(4, '0')
    return `-${yearStr}-${month}-${day}T${hour}:${minute}:00`
  }
  
  // 匹配普通格式: "2024-01-15 10:00"
  const adMatch = gameTimeStr.match(/^(\d+)-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/)
  if (adMatch) {
    const [, year, month, day, hour, minute] = adMatch
    return `${year.padStart(4, '0')}-${month}-${day}T${hour}:${minute}:00`
  }
  
  // 如果已经是ISO格式，直接返回
  return gameTimeStr
}

export function MessageEditDialog({
  open,
  onOpenChange,
  message,
  sessionId,
  currentGameTime,
}: MessageEditDialogProps) {
  const queryClient = useQueryClient()
  const isEditing = !!message

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    brief: '',
    msgType: 'NEWS' as 'EVENT' | 'NEWS' | 'CRISIS',
    publishRealTime: '',
    publishGameTime: '',
    isSecret: false,
    sessionId: sessionId || '',
  })

  const createMutation = useCreate1({
    mutation: {
      onSuccess: () => {
        alert('消息创建成功')
        queryClient.invalidateQueries({ queryKey: ['/api/messages'] })
        onOpenChange(false)
        resetForm()
      },
      onError: (error) => {
        console.error('Create message error:', error)
        alert('消息创建失败，请稍后重试')
      },
    },
  })

  const updateMutation = useUpdate({
    mutation: {
      onSuccess: () => {
        alert('消息更新成功')
        queryClient.invalidateQueries({ queryKey: ['/api/messages'] })
        onOpenChange(false)
        resetForm()
      },
      onError: (error) => {
        console.error('Update message error:', error)
        alert('消息更新失败，请稍后重试')
      },
    },
  })

  useEffect(() => {
    if (message && open) {
      setFormData({
        title: message.title || '',
        content: message.content || '',
        brief: message.brief || '',
        msgType: (message.msgType || 'NEWS') as 'EVENT' | 'NEWS' | 'CRISIS',
        publishRealTime: message.publishRealTime || '',
        publishGameTime: message.publishGameTime || '',
        isSecret: message.isSecret || false,
        sessionId: message.sessionId || sessionId || '',
      })
    } else if (!message && open) {
      // 只在创建时使用当前游戏时间作为默认值
      setFormData({
        title: '',
        content: '',
        brief: '',
        msgType: 'NEWS',
        publishRealTime: '',
        publishGameTime: currentGameTime || '',
        isSecret: false,
        sessionId: sessionId || '',
      })
    }
    // 不包含currentGameTime，避免每次时间更新时重置表单
  }, [message, open, sessionId])

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      brief: '',
      msgType: 'NEWS',
      publishRealTime: '',
      publishGameTime: currentGameTime || '',
      isSecret: false,
      sessionId: sessionId || '',
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      alert('请输入标题')
      return
    }

    if (!formData.content.trim()) {
      alert('请输入内容')
      return
    }

    if (!formData.publishGameTime.trim()) {
      alert('请输入发布游戏时间')
      return
    }

    if (isEditing && message) {
      // 更新消息
      const updateData: MessageUpdateRequest = {
        title: formData.title,
        content: formData.content,
        brief: formData.brief || undefined,
        msgType: formData.msgType,
        publishRealTime: formData.publishRealTime || undefined,
        publishGameTime: parseGameTimeToISO(formData.publishGameTime),
        isSecret: formData.isSecret,
      }
      updateMutation.mutate({ uuid: message.uuid, data: updateData })
    } else {
      // 创建消息
      if (!formData.sessionId) {
        alert('会期ID不能为空')
        return
      }

      const createData: MessageCreateRequest = {
        sessionId: formData.sessionId,
        title: formData.title,
        content: formData.content,
        brief: formData.brief || undefined,
        msgType: formData.msgType,
        publishRealTime: formData.publishRealTime || undefined,
        publishGameTime: parseGameTimeToISO(formData.publishGameTime),
        isSecret: formData.isSecret,
      }
      createMutation.mutate({ data: createData })
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="default">
        <form onSubmit={handleSubmit}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isEditing ? '编辑消息' : '创建消息'}
            </AlertDialogTitle>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">标题 *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="请输入消息标题"
                required
              />
            </div>

            {/* Message Type */}
            <div className="space-y-2">
              <Label htmlFor="msgType">消息类型 *</Label>
              <select
                id="msgType"
                value={formData.msgType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    msgType: e.target.value as 'EVENT' | 'NEWS' | 'CRISIS',
                  })
                }
                className="flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                required
              >
                {MSG_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Brief */}
            <div className="space-y-2">
              <Label htmlFor="brief">摘要</Label>
              <Textarea
                id="brief"
                value={formData.brief}
                onChange={(e) => setFormData({ ...formData, brief: e.target.value })}
                placeholder="消息摘要（可选，默认截取内容前30字）"
                rows={2}
              />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content">内容 *</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="请输入消息详细内容（支持富文本）"
                rows={6}
                required
              />
            </div>

            {/* Game Time */}
            <div className="space-y-2">
              <Label htmlFor="publishGameTime">发布游戏时间 *</Label>
              <Input
                id="publishGameTime"
                value={formData.publishGameTime}
                onChange={(e) =>
                  setFormData({ ...formData, publishGameTime: e.target.value })
                }
                placeholder="例如: 2024-01-15 10:00"
                required
              />
            </div>

            {/* Real Time */}
            <div className="space-y-2">
              <Label htmlFor="publishRealTime">发布现实时间（可选，留空则使用服务器时间）</Label>
              <Input
                id="publishRealTime"
                type="datetime-local"
                value={formData.publishRealTime}
                onChange={(e) =>
                  setFormData({ ...formData, publishRealTime: e.target.value })
                }
              />
            </div>

            {/* Session ID (only for create) */}
            {!isEditing && (
              <div className="space-y-2">
                <Label htmlFor="sessionId">会期ID *</Label>
                <Input
                  id="sessionId"
                  value={formData.sessionId}
                  onChange={(e) => setFormData({ ...formData, sessionId: e.target.value })}
                  placeholder="请输入会期UUID"
                  required
                />
              </div>
            )}

            {/* Is Secret */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isSecret"
                checked={formData.isSecret}
                onChange={(e) =>
                  setFormData({ ...formData, isSecret: e.target.checked })
                }
                className="w-4 h-4 rounded border-gray-300"
              />
              <Label htmlFor="isSecret" className="cursor-pointer">
                是非对称消息？
              </Label>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={isLoading}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction type="submit" disabled={isLoading}>
              {isLoading ? '提交中...' : isEditing ? '更新' : '创建'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
