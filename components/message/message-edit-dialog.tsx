'use client'

import { useState, useEffect } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useCreate1, useUpdate, useGetOne, useGetReceivers } from '@/lib/api/endpoints/消息管理/消息管理'
import { useGetUsers } from '@/lib/api/endpoints/会议管理/会议管理'
import { AXIOS_INSTANCE } from '@/lib/api/client'
import type {
  MessageResponse,
  MessageCreateRequest,
  MessageUpdateRequest,
  UserInfoResponse,
  ResultAttachmentUploadResponse,
} from '@/lib/api/endpoints/asyaBackendAPI.schemas'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/contexts/auth-context'
import { toast } from 'react-toastify'

interface MessageEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message?: MessageResponse | null
  currentGameTime?: string
}

interface AttachmentItem {
  uuid: string
  fileName: string
  fileType?: string
}

function normalizeAttachmentItems(rawMessage: any): AttachmentItem[] {
  const attachmentUuids: string[] = rawMessage?.attachmentUuids || []
  const inlineInfos = rawMessage?.attachmentInfos || rawMessage?.attachments || []

  const infoMap = (Array.isArray(inlineInfos) ? inlineInfos : []).reduce(
    (acc: Record<string, { fileName?: string; fileType?: string }>, item: any) => {
      if (item?.uuid) {
        acc[item.uuid] = {
          fileName: item.fileName,
          fileType: item.fileType,
        }
      }
      return acc
    },
    {}
  )

  return attachmentUuids.map((uuid) => {
    const info = infoMap[uuid]
    return {
      uuid,
      fileName: info?.fileName || uuid,
      fileType: info?.fileType,
    }
  })
}

function getMessageIsSecret(rawMessage: any): boolean {
  const rawValue = rawMessage?.isSecret ?? rawMessage?.is_secret ?? rawMessage?.secret ?? false

  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes'
  }

  return Boolean(rawValue)
}

function extractReceiverUserIds(rawData: any): string[] {
  try {
    const responseData = rawData?.data
    if (!responseData) return []

    const parsed = typeof responseData === 'string' ? JSON.parse(responseData) : responseData
    const payload = parsed?.data ?? parsed

    if (!Array.isArray(payload)) return []

    return payload
      .map((item: any) => {
        if (typeof item === 'string') return item
        return item?.uuid || item?.userUuid || item?.user_uuid || item?.id || ''
      })
      .filter((uuid: string) => !!uuid)
  } catch (err) {
    console.error('Failed to parse message receivers:', err)
    return []
  }
}

const MSG_TYPE_OPTIONS = [
  { value: 'EVENT', label: '事件' },
  { value: 'NEWS', label: '新闻' },
  { value: 'CRISIS', label: '危机' },
  { value: 'WAR_REPORT', label: '战报' },
  { value: 'SECRET_LETTER', label: '密函' },
]

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  'docx',
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'svg',
  'avif',
  'heic',
  'heif',
])

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
  'image/avif',
  'image/heic',
  'image/heif',
])

const ATTACHMENT_ACCEPT = '.docx,.pdf,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.avif,.heic,.heif'

function getFileExtension(fileName: string): string {
  const normalized = fileName.trim().toLowerCase()
  if (!normalized.includes('.')) return ''
  return normalized.split('.').pop() || ''
}

function isAllowedAttachmentFile(file: File): boolean {
  const ext = getFileExtension(file.name)
  if (ext && ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) return true

  const mimeType = (file.type || '').trim().toLowerCase()
  return mimeType ? ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType) : false
}

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
  currentGameTime,
}: MessageEditDialogProps) {
  const queryClient = useQueryClient()
  const { canManageConference } = useAuth()
  const isEditing = !!message

  // 获取完整的消息详情（包含 content）
  const { data: messageDetailData } = useGetOne(
    message?.uuid || '',
    {
      query: {
        enabled: open && isEditing && !!message?.uuid,
      },
    }
  )

  const { data: receiversData } = useGetReceivers(
    message?.uuid || '',
    {
      query: {
        enabled: open && isEditing && !!message?.uuid && canManageConference,
      },
    }
  )

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    brief: '',
    msgType: 'NEWS' as 'EVENT' | 'NEWS' | 'CRISIS' | 'WAR_REPORT' | 'SECRET_LETTER',
    publishRealTime: '',
    publishGameTime: '',
    isSecret: false,
  })

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [attachmentToRemove, setAttachmentToRemove] = useState<AttachmentItem | null>(null)
  const [isDeletingAttachmentOnServer, setIsDeletingAttachmentOnServer] = useState(false)

  // 获取会议的所有用户
  const { data: usersData } = useGetUsers({
    query: {
      enabled: open && formData.isSecret && canManageConference,
    },
  })

  const conferenceUsers = (() => {
    try {
      if (!usersData) return []
      const responseData = (usersData as any).data
      if (!responseData) return []
      
      const parsed = typeof responseData === 'string' 
        ? JSON.parse(responseData) 
        : responseData
      
      return (parsed.data || parsed) as UserInfoResponse[]
    } catch (err) {
      console.error('Failed to parse users data:', err)
      return []
    }
  })()

  const getUserLabel = (targetUser: UserInfoResponse) => {
    const displayName = targetUser.displayName?.trim()
    return displayName ? `${displayName}（${targetUser.name}）` : targetUser.name
  }

  const createMutation = useCreate1({
    mutation: {
      onSuccess: () => {
        toast.success('消息创建成功')
        queryClient.invalidateQueries({ queryKey: ['/api/messages'] })
        onOpenChange(false)
        resetForm()
      },
      onError: (error) => {
        console.error('Create message error:', error)
        toast.error('消息创建失败，请稍后重试')
      },
    },
  })

  const updateMutation = useUpdate({
    mutation: {
      onSuccess: () => {
        toast.success('消息更新成功')
        queryClient.invalidateQueries({ queryKey: ['/api/messages'] })
        queryClient.invalidateQueries({ queryKey: ['/api/messages/secret/conference'] })
        onOpenChange(false)
        resetForm()
      },
      onError: (error) => {
        console.error('Update message error:', error)
        toast.error('消息更新失败，请稍后重试')
      },
    },
  })

  useEffect(() => {
    let cancelled = false

    if (message && open) {
      // 尝试从详情数据中获取完整信息
      let fullMessage = message
      
      if (messageDetailData) {
        try {
          const responseData = (messageDetailData as any).data
          if (responseData) {
            const parsed = typeof responseData === 'string' 
              ? JSON.parse(responseData) 
              : responseData
            const detailMsg = parsed.data || parsed
            fullMessage = detailMsg
          }
        } catch (err) {
          console.error('Failed to parse message detail:', err)
        }
      }
      
      setFormData({
        title: fullMessage.title || '',
        content: fullMessage.content || '',
        brief: fullMessage.brief || '',
        msgType: (fullMessage.msgType || 'NEWS') as 'EVENT' | 'NEWS' | 'CRISIS' | 'WAR_REPORT' | 'SECRET_LETTER',
        publishRealTime: fullMessage.publishRealTime || '',
        publishGameTime: fullMessage.publishGameTime || '',
        isSecret: getMessageIsSecret(fullMessage),
      })

      const initialAttachments = normalizeAttachmentItems(fullMessage)
      setAttachments(initialAttachments)

      const missingNameUuids = initialAttachments
        .filter((attachment) => attachment.fileName === attachment.uuid)
        .map((attachment) => attachment.uuid)

      if (missingNameUuids.length > 0) {
        AXIOS_INSTANCE.get('/api/attachments')
          .then((response) => {
            if (cancelled) return

            const payload = response.data
            const list = Array.isArray(payload?.data)
              ? payload.data
              : Array.isArray(payload)
                ? payload
                : []

            const fetchedMap = (list as any[])
              .filter((item) => item?.uuid && missingNameUuids.includes(item.uuid))
              .reduce((acc, item) => {
                acc[item.uuid] = {
                  fileName: item.fileName,
                  fileType: item.fileType,
                }
                return acc
              }, {} as Record<string, { fileName?: string; fileType?: string }>)

            setAttachments((prev) =>
              prev.map((attachment) => {
                const fetched = fetchedMap[attachment.uuid]
                if (!fetched?.fileName) return attachment
                return {
                  ...attachment,
                  fileName: fetched.fileName,
                  fileType: fetched.fileType || attachment.fileType,
                }
              })
            )
          })
          .catch((err) => {
            console.warn('Failed to fetch attachment info for edit dialog:', err)
          })
      }

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
      })
      setSelectedUserIds([])
      setAttachments([])
    }

    return () => {
      cancelled = true
    }
    // 不包含currentGameTime，避免每次时间更新时重置表单
  }, [message, open, messageDetailData])

  useEffect(() => {
    if (!open || !isEditing || !canManageConference) return
    setSelectedUserIds(extractReceiverUserIds(receiversData))
  }, [open, isEditing, canManageConference, receiversData])

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      brief: '',
      msgType: 'NEWS',
      publishRealTime: '',
      publishGameTime: currentGameTime || '',
      isSecret: false,
    })
    setSelectedUserIds([])
    setAttachments([])
  }

  const copyMessageContentToClipboard = async (content: string) => {
    if (!content) return

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content)
        return
      }
    } catch (err) {
      console.error('Failed to copy message content:', err)
    }

    try {
      if (typeof document === 'undefined') return
      const textarea = document.createElement('textarea')
      textarea.value = content
      textarea.setAttribute('readonly', 'true')
      textarea.style.position = 'absolute'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    } catch (err) {
      console.error('Fallback copy failed:', err)
    }
  }

  const uploadAttachment = async (file: File): Promise<AttachmentItem | null> => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await AXIOS_INSTANCE.post<ResultAttachmentUploadResponse>(
        '/api/attachments',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      const uploaded = response.data?.data
      if (!uploaded?.uuid) {
        throw new Error('上传成功但未返回附件UUID')
      }

      return {
        uuid: uploaded.uuid,
        fileName: uploaded.fileName,
        fileType: uploaded.fileType,
      }
    } catch (err) {
      console.error('Upload attachment error:', err)
      return null
    }
  }

  const handleAttachmentFilesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const fileList = Array.from(files)
    const allowedFiles = fileList.filter((file) => isAllowedAttachmentFile(file))
    const rejectedFiles = fileList.filter((file) => !isAllowedAttachmentFile(file))

    if (rejectedFiles.length > 0) {
      toast.warning('仅支持上传 docx、pdf 和常见图片格式（png/jpg/jpeg/gif/webp/bmp/svg/avif/heic/heif）')
    }

    if (allowedFiles.length === 0) {
      event.target.value = ''
      return
    }

    setIsUploadingAttachments(true)

    try {
      const uploadedItems = await Promise.all(allowedFiles.map((file) => uploadAttachment(file)))
      const successItems = uploadedItems.filter((item): item is AttachmentItem => !!item)

      if (successItems.length > 0) {
        setAttachments((prev) => {
          const merged = [...prev]
          successItems.forEach((item) => {
            if (!merged.some((existing) => existing.uuid === item.uuid)) {
              merged.push(item)
            }
          })
          return merged
        })
        toast.success(`已上传 ${successItems.length} 个附件`)
      }

      if (successItems.length < allowedFiles.length) {
        toast.error(`有 ${allowedFiles.length - successItems.length} 个附件上传失败`)
      }
    } finally {
      setIsUploadingAttachments(false)
      event.target.value = ''
    }
  }

  const removeAttachment = (uuid: string) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.uuid !== uuid))
  }

  const openRemoveAttachmentDialog = (attachment: AttachmentItem) => {
    setAttachmentToRemove(attachment)
    setRemoveDialogOpen(true)
  }

  const closeRemoveAttachmentDialog = () => {
    if (isDeletingAttachmentOnServer) return
    setRemoveDialogOpen(false)
    setAttachmentToRemove(null)
  }

  const handleRemoveAttachmentOnly = () => {
    if (!attachmentToRemove) return
    removeAttachment(attachmentToRemove.uuid)
    setRemoveDialogOpen(false)
    setAttachmentToRemove(null)
    toast.success('已移除附件关联')
  }

  const handleRemoveAndDeleteAttachment = async () => {
    if (!attachmentToRemove) return

    setIsDeletingAttachmentOnServer(true)
    try {
      await AXIOS_INSTANCE.delete(`/api/attachments/${attachmentToRemove.uuid}`)
      removeAttachment(attachmentToRemove.uuid)
      toast.success('已移除附件并从服务器删除')
      setRemoveDialogOpen(false)
      setAttachmentToRemove(null)
    } catch (err) {
      console.error('Delete attachment on server failed:', err)
      toast.error('删除服务器附件失败，请稍后重试')
    } finally {
      setIsDeletingAttachmentOnServer(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast.warning('请输入标题')
      return
    }

    if (!formData.content.trim()) {
      toast.warning('请输入内容')
      return
    }

    if (!formData.publishGameTime.trim()) {
      toast.warning('请输入发布游戏时间')
      return
    }

    if (formData.isSecret && selectedUserIds.length === 0) {
      toast.warning('非对称消息必须至少选择一个接收用户')
      return
    }

    if (isUploadingAttachments) {
      toast.warning('附件正在上传，请稍候再提交')
      return
    }

    await copyMessageContentToClipboard(formData.content)

    const attachmentUuids = attachments.map((attachment) => attachment.uuid)

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
        attachmentUuids,
      }
      updateMutation.mutate({ uuid: message.uuid, data: updateData })
    } else {
      // 创建消息
      const createData: MessageCreateRequest = {
        title: formData.title,
        content: formData.content,
        brief: formData.brief || undefined,
        msgType: formData.msgType,
        publishRealTime: formData.publishRealTime || undefined,
        publishGameTime: parseGameTimeToISO(formData.publishGameTime),
        isSecret: formData.isSecret,
        receiverIds: formData.isSecret ? selectedUserIds : undefined,
        attachmentUuids: attachmentUuids.length > 0 ? attachmentUuids : undefined,
      }
      createMutation.mutate({ data: createData })
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending || isUploadingAttachments

  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="!max-w-4xl max-h-[90vh] flex flex-col">
          <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
            <AlertDialogHeader className="flex-shrink-0">
              <AlertDialogTitle>
                {isEditing ? '编辑消息' : '创建消息'}
              </AlertDialogTitle>
            </AlertDialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4 overflow-y-auto flex-1 px-1 -mx-1">
            {/* 左栏：基本信息 */}
            <div className="space-y-4">
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
                      msgType: e.target.value as 'EVENT' | 'NEWS' | 'CRISIS' | 'WAR_REPORT' | 'SECRET_LETTER',
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
                  rows={10}
                  required
                />
              </div>
            </div>

            {/* 右栏：发布设置和用户选择 */}
            <div className="space-y-4">
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
                <Label htmlFor="publishRealTime">发布现实时间（可选）</Label>
                <Input
                  id="publishRealTime"
                  type="datetime-local"
                  value={formData.publishRealTime}
                  onChange={(e) =>
                    setFormData({ ...formData, publishRealTime: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">留空则使用服务器时间</p>
              </div>

              {/* Attachments */}
              <div className="space-y-2">
                <Label htmlFor="attachments">附件</Label>
                <Input
                  id="attachments"
                  type="file"
                  multiple
                  accept={ATTACHMENT_ACCEPT}
                  onChange={handleAttachmentFilesChange}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  仅支持 docx、pdf 和常见图片格式（png/jpg/jpeg/gif/webp/bmp/svg/avif/heic/heif）
                </p>

                {attachments.length > 0 && (
                  <div className="space-y-2 rounded border p-2 bg-muted/30">
                    {attachments.map((attachment) => (
                      <div key={attachment.uuid} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {attachment.fileName}{attachment.fileType ? `.${attachment.fileType}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">UUID: {attachment.uuid}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openRemoveAttachmentDialog(attachment)}
                          className="text-xs text-destructive hover:underline flex-shrink-0"
                          disabled={isLoading}
                        >
                          移除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Session ID (only for create) */}
              {/* Is Secret */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isSecret"
                  checked={formData.isSecret}
                  onChange={(e) => {
                    setFormData({ ...formData, isSecret: e.target.checked })
                    if (!e.target.checked) {
                      setSelectedUserIds([])
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-300"
                  disabled={!canManageConference}
                />
                <Label htmlFor="isSecret" className="cursor-pointer">
                  是非对称消息？
                </Label>
              </div>

              {/* User Selection for Secret Messages */}
              {formData.isSecret && canManageConference && (
                <div className="space-y-2 border rounded-lg p-4 bg-muted/50 flex-1">
                  <div className="flex items-center justify-between">
                    <Label>选择接收用户 *</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedUserIds(conferenceUsers.map(u => u.uuid))}
                        className="text-xs text-primary hover:underline"
                      >
                        全选
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedUserIds([])}
                        className="text-xs text-primary hover:underline"
                      >
                        清空
                      </button>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-2 border rounded p-2 bg-background">
                    {conferenceUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-2">加载用户列表...</p>
                    ) : (
                      conferenceUsers.map((conferenceUser) => (
                        <div key={conferenceUser.uuid} className="flex items-center gap-2 hover:bg-muted/50 p-2 rounded">
                          <input
                            type="checkbox"
                            id={`user-${conferenceUser.uuid}`}
                            checked={selectedUserIds.includes(conferenceUser.uuid)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUserIds([...selectedUserIds, conferenceUser.uuid])
                              } else {
                                setSelectedUserIds(selectedUserIds.filter(id => id !== conferenceUser.uuid))
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300 flex-shrink-0"
                          />
                          <Label 
                            htmlFor={`user-${conferenceUser.uuid}`} 
                            className="cursor-pointer text-sm flex-1"
                          >
                            {getUserLabel(conferenceUser)} <span className="text-muted-foreground">({conferenceUser.role})</span>
                          </Label>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">
                    已选择 {selectedUserIds.length} / {conferenceUsers.length} 个用户
                  </p>
                </div>
              )}
            </div>
          </div>

            <AlertDialogFooter className="flex-shrink-0 mt-4">
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

      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>移除附件</AlertDialogTitle>
            <AlertDialogDescription>
              是否移除附件
              {attachmentToRemove ? `「${attachmentToRemove.fileName}${attachmentToRemove.fileType ? `.${attachmentToRemove.fileType}` : ''}」` : ''}
              ？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              type="button"
              disabled={isDeletingAttachmentOnServer}
              onClick={closeRemoveAttachmentDialog}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={isDeletingAttachmentOnServer}
              onClick={handleRemoveAttachmentOnly}
            >
              仅移除关联
            </AlertDialogAction>
            <AlertDialogAction
              type="button"
              disabled={isDeletingAttachmentOnServer}
              onClick={handleRemoveAndDeleteAttachment}
            >
              {isDeletingAttachmentOnServer ? '删除中...' : '移除并删除服务器附件'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
