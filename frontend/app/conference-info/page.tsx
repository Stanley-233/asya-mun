'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { useAuth } from "@/lib/contexts/auth-context"
import { buildLoginRedirect } from '@/lib/auth/return-to'
import {
  useGetMine,
  useUpdate2,
  useGetUsers,
  useGetDelegates
} from "@/lib/api/hooks/conference"
import {
  useGetAllUserGroups,
  useCreateUserGroup,
  useUpdateUserGroup,
  useDeleteUserGroup,
  useSetGroupMembers
} from "@/lib/api/hooks/user-group"
import { useBatchRegister, useResetPassword } from "@/lib/api/hooks/user"
import type {
  ConferenceResponse,
  ConferenceRequestStatus,
  UserInfoResponse,
  UserGroupResponse,
  BatchRegisterUserItem
} from "@/lib/api/generated"
import type { ListDelegatesParams } from "@/lib/api/apis/conference.api"
import { parseApiPayload } from '@/lib/api/response-utils'

const statusLabels = {
  'PREPARING': '筹备中',
  'RUNNING': '进行中',
  'COMPLETED': '已结束'
}

const statusOptions = [
  { value: 'PREPARING', label: '筹备中' },
  { value: 'RUNNING', label: '进行中' },
  { value: 'COMPLETED', label: '已结束' },
]

const roleLabels: Record<string, string> = {
  'SYS_ADMIN': '系统管理员',
  'DELEGATE': '代表',
  'DM': '主席团成员',
  'DH': '主席团指导'
}

function DraggableUserRow({ user, getUserLabel, onDetailStart, onResetPasswordStart, canManageDelegates }: {
  user: UserInfoResponse
  getUserLabel: (user: UserInfoResponse) => string
  onDetailStart: (user: UserInfoResponse) => void
  onResetPasswordStart: (user: UserInfoResponse) => void
  canManageDelegates: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `user-${user.uuid}`,
    data: { user }
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  return (
    <tr
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${isDragging ? 'opacity-50' : ''} cursor-grab active:cursor-grabbing`}
    >
      <td className="py-3 px-4 font-medium">{user.name}</td>
      <td className="py-3 px-4">{user.displayName || '—'}</td>
      <td className="py-3 px-4 text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onDetailStart(user) }}
          >
            详情
          </Button>
          {canManageDelegates && (
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onResetPasswordStart(user) }}
            >
              重置密码
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

function DroppableGroupCard({ group, children, onOpenMemberManagement, onOpenEditGroupForm, onDeleteGroup }: {
  group: UserGroupResponse
  children: React.ReactNode
  onOpenMemberManagement: (group: UserGroupResponse) => void
  onOpenEditGroupForm: (group: UserGroupResponse) => void
  onDeleteGroup: (id: number) => void
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `group-${group.id}`,
    data: { group }
  })

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
        isOver ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted/50'
      }`}
    >
      {children}
    </div>
  )
}

export default function ConferenceInfoPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()

  const getUserLabel = (targetUser: UserInfoResponse) => {
    const displayName = targetUser.displayName?.trim()
    return displayName ? `${displayName}（${targetUser.name}）` : targetUser.name
  }

  const canManageConference = user?.role === 'DM' || user?.role === 'DH' || user?.role === 'SYS_ADMIN'

  const { data: conferenceData, isLoading: conferenceLoading } = useGetMine()
  const { data: usersData } = useGetUsers({
    query: {
      enabled: isAuthenticated && canManageConference,
    }
  })
  const { mutate: updateConference, isPending: isUpdating } = useUpdate2()

  const { data: groupsData, refetch: refetchGroups, isLoading: groupsLoading, error: groupsError } = useGetAllUserGroups({
    query: { enabled: isAuthenticated && canManageConference }
  })
  const { mutate: createGroup, isPending: isCreatingGroup } = useCreateUserGroup()
  const { mutate: updateGroup, isPending: isUpdatingGroup } = useUpdateUserGroup()
  const { mutate: deleteGroup, isPending: isDeletingGroup } = useDeleteUserGroup()
  const { mutate: setMembers, isPending: isSettingMembers } = useSetGroupMembers()

  const { mutate: batchRegister, isPending: isBatchRegistering } = useBatchRegister()
  const { mutate: resetPassword, isPending: isResettingPassword } = useResetPassword()

  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'PREPARING' as ConferenceRequestStatus
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [groupNameInput, setGroupNameInput] = useState('')
  const [editingGroup, setEditingGroup] = useState<UserGroupResponse | null>(null)
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [managingGroup, setManagingGroup] = useState<UserGroupResponse | null>(null)
  const [selectedUuids, setSelectedUuids] = useState<string[]>([])
  const [memberKeyword, setMemberKeyword] = useState('')
  const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null)

  const conference = useMemo(
    () => parseApiPayload<ConferenceResponse>(conferenceData),
    [conferenceData],
  )
  const users = useMemo(
    () => parseApiPayload<UserInfoResponse[]>(usersData) ?? [],
    [usersData],
  )
  const groups = useMemo(
    () => parseApiPayload<UserGroupResponse[]>(groupsData) ?? [],
    [groupsData],
  )

  const canManageDelegates = user?.role === 'DH' || user?.role === 'SYS_ADMIN'

  const [delegateNameFilter, setDelegateNameFilter] = useState('')
  const [appliedDelegateNameFilter, setAppliedDelegateNameFilter] = useState('')
  const [delegatePage, setDelegatePage] = useState(0)
  const DELEGATE_PAGE_SIZE = 10

  const delegateParams = useMemo<ListDelegatesParams>(() => ({
    name: appliedDelegateNameFilter.trim() || undefined,
    pageable: {
      page: delegatePage,
      size: DELEGATE_PAGE_SIZE,
      sort: ['name,asc'],
    },
  }), [appliedDelegateNameFilter, delegatePage])

  const { data: delegatesData, isLoading: delegatesLoading, refetch: refetchDelegates } = useGetDelegates(delegateParams, {
    query: { enabled: isAuthenticated && canManageDelegates && !!conference }
  })

  const delegates = useMemo(() => delegatesData?.content ?? [], [delegatesData])
  const totalDelegatePages = delegatesData?.totalPages ?? 0
  const totalDelegateElements = delegatesData?.totalElements ?? 0

  const [batchDialogOpen, setBatchDialogOpen] = useState(false)
  const [batchUsers, setBatchUsers] = useState<BatchRegisterUserItem[]>([])
  const [batchCsvError, setBatchCsvError] = useState<string | null>(null)

  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [userToReset, setUserToReset] = useState<UserInfoResponse | null>(null)
  const [resetForm, setResetForm] = useState({ password: '', confirmPassword: '' })

  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailUser, setDetailUser] = useState<UserInfoResponse | null>(null)

  // Drag and drop state
  const [activeUser, setActiveUser] = useState<UserInfoResponse | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const filteredUsers = useMemo(() => {
    const keyword = memberKeyword.trim().toLowerCase()
    if (!keyword) return users
    return users.filter(user => {
      const normalizedDisplayName = (user.displayName?.trim() || '').toLowerCase()
      const normalizedName = (user.name || '').toLowerCase()
      return normalizedDisplayName.includes(keyword) || normalizedName.includes(keyword)
    })
  }, [memberKeyword, users])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.push(buildLoginRedirect())
      return
    }
    if (!canManageConference) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, canManageConference, router])

  const openCreateGroupForm = () => {
    setEditingGroup(null)
    setGroupNameInput('')
    setShowGroupForm(true)
  }

  const openEditGroupForm = (group: UserGroupResponse) => {
    setEditingGroup(group)
    setGroupNameInput(group.groupName)
    setShowGroupForm(true)
  }

  const handleSaveGroup = () => {
    if (!groupNameInput.trim()) return
    if (editingGroup) {
      updateGroup(
        { id: editingGroup.id, data: { groupName: groupNameInput } },
        { onSuccess: () => { refetchGroups(); setShowGroupForm(false); setEditingGroup(null) } }
      )
    } else {
      createGroup(
        { data: { groupName: groupNameInput } },
        { onSuccess: () => { refetchGroups(); setShowGroupForm(false); setGroupNameInput('') } }
      )
    }
  }

  const handleDeleteGroup = () => {
    if (deletingGroupId === null) return
    deleteGroup(
      { id: deletingGroupId },
      { onSuccess: () => { refetchGroups(); setDeletingGroupId(null) } }
    )
  }

  const openMemberManagement = (group: UserGroupResponse) => {
    setManagingGroup(group)
    setSelectedUuids([...group.userUuids])
    setMemberKeyword('')
  }

  const toggleUserInGroup = (uuid: string) => {
    setSelectedUuids(prev =>
      prev.includes(uuid) ? prev.filter(u => u !== uuid) : [...prev, uuid]
    )
  }

  const handleSaveMembers = () => {
    if (!managingGroup) return
    setMembers(
      { id: managingGroup.id, data: { userUuids: selectedUuids } },
      { onSuccess: () => { refetchGroups(); setManagingGroup(null); setMemberKeyword('') } }
    )
  }

  const handleSelectAllUsers = () => {
    setSelectedUuids(users.map(u => u.uuid))
  }

  const handleClearSelectedUsers = () => {
    setSelectedUuids([])
  }

  const parseCsvLine = (line: string) => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i += 1 }
        else { inQuotes = !inQuotes }
        continue
      }
      if (char === ',' && !inQuotes) { result.push(current); current = ''; continue }
      current += char
    }
    result.push(current)
    return result.map(item => item.trim())
  }

  const parseCsvContent = (text: string): BatchRegisterUserItem[] => {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const lines = normalized.split('\n').map(line => line.trim()).filter(Boolean)
    if (lines.length === 0) return []
    const rows = lines.map(parseCsvLine)
    const header = rows[0].map(item => item.toLowerCase())
    const hasHeader = header.includes('name') && header.includes('password')
    const dataRows = hasHeader ? rows.slice(1) : rows
    const nameIndex = hasHeader ? header.indexOf('name') : 0
    const displayNameIndex = hasHeader ? header.indexOf('displayname') : 1
    const passwordIndex = hasHeader ? header.indexOf('password') : 2
    return dataRows
      .filter(row => row.some(cell => cell.trim().length > 0))
      .map(row => ({
        name: row[nameIndex]?.trim() || '',
        displayName: row[displayNameIndex]?.trim() || '',
        password: row[passwordIndex]?.trim() || '',
      }))
  }

  const handleBatchCsvUpload = async (file?: File) => {
    if (!file) return
    setBatchCsvError(null)
    try {
      const text = await file.text()
      const parsedUsers = parseCsvContent(text)
      if (parsedUsers.length === 0) {
        setBatchCsvError('未解析到有效的用户数据')
        return
      }
      setBatchUsers(parsedUsers)
    } catch {
      setBatchCsvError('读取 CSV 失败，请检查文件格式')
    }
  }

  const handleAddBatchUser = () => {
    setBatchUsers(prev => ([...prev, { name: '', displayName: '', password: '' }]))
  }

  const handleRemoveBatchUser = (index: number) => {
    setBatchUsers(prev => prev.filter((_, i) => i !== index))
  }

  const handleBatchUserChange = (index: number, field: keyof BatchRegisterUserItem, value: string) => {
    setBatchUsers(prev => prev.map((item, i) => (
      i === index ? { ...item, [field]: value } : item
    )))
  }

  const handleOpenBatchDialog = () => {
    setBatchDialogOpen(true)
    setBatchCsvError(null)
  }

  const handleCloseBatchDialog = () => {
    setBatchDialogOpen(false)
    setBatchUsers([])
    setBatchCsvError(null)
  }

  const handleConfirmBatchRegister = () => {
    if (!conference) {
      toast.error('当前未关联会议')
      return
    }
    if (batchUsers.length === 0) {
      toast.error('请添加至少一位代表')
      return
    }
    const sanitizedUsers = batchUsers.map(u => ({
      name: u.name.trim(),
      displayName: u.displayName?.trim() || '',
      password: u.password.trim(),
    }))
    const hasInvalid = sanitizedUsers.some(u => !u.name || !u.password)
    if (hasInvalid) {
      toast.error('用户昵称和密码不能为空')
      return
    }
    batchRegister(
      { data: { conferenceId: conference.uuid, users: sanitizedUsers } },
      {
        onSuccess: () => {
          toast.success(`批量注册成功（${sanitizedUsers.length} 人）`)
          handleCloseBatchDialog()
          void refetchDelegates()
        },
        onError: () => { toast.error('批量注册失败，请重试') },
      }
    )
  }

  const handleResetPasswordStart = (targetUser: UserInfoResponse) => {
    setUserToReset(targetUser)
    setResetForm({ password: '', confirmPassword: '' })
    setResetDialogOpen(true)
  }

  const handleDetailStart = (targetUser: UserInfoResponse) => {
    setDetailUser(targetUser)
    setDetailDialogOpen(true)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const user = event.active.data.current?.user as UserInfoResponse
    setActiveUser(user)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveUser(null)

    if (!over) return

    const user = active.data.current?.user as UserInfoResponse
    const group = over.data.current?.group as UserGroupResponse

    if (!user || !group) return

    // Check if user is already in the group
    if (group.userUuids.includes(user.uuid)) {
      toast.info('该用户已在该组中')
      return
    }

    // Add user to group
    const newUserUuids = [...group.userUuids, user.uuid]
    setMembers(
      { id: group.id, data: { userUuids: newUserUuids } },
      { onSuccess: () => { refetchGroups(); toast.success(`已将 ${getUserLabel(user)} 添加到 ${group.groupName}`) } }
    )
  }

  const detailUserGroups = useMemo(() => {
    if (!detailUser) return []
    return groups.filter(g => g.userUuids.includes(detailUser.uuid))
  }, [detailUser, groups])

  const handleConfirmResetPassword = () => {
    if (!userToReset) return
    if (!resetForm.password || !resetForm.confirmPassword) {
      toast.error('请填写新密码并确认')
      return
    }
    if (resetForm.password !== resetForm.confirmPassword) {
      toast.error('两次输入的密码不一致')
      return
    }
    if (resetForm.password.length < 6) {
      toast.error('密码长度不少于 6 个字符')
      return
    }
    resetPassword(
      { uuid: userToReset.uuid, data: { password: resetForm.password } },
      {
        onSuccess: () => {
          toast.success('密码重置成功')
          setResetDialogOpen(false)
          setUserToReset(null)
          setResetForm({ password: '', confirmPassword: '' })
        },
        onError: () => { toast.error('重置失败，请重试') },
      }
    )
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleStatusChange = (value: string) => {
    setFormData(prev => ({ ...prev, status: value as ConferenceRequestStatus }))
  }

  const handleEdit = () => {
    if (conference) {
      setFormData({
        name: conference.name,
        description: conference.description,
        status: conference.status,
      })
    }
    setIsEditing(true)
    setMessage(null)
  }

  const handleCancel = () => {
    if (conference) {
      setFormData({
        name: conference.name,
        description: conference.description,
        status: conference.status
      })
    }
    setIsEditing(false)
    setMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: '会议名称不能为空' })
      return
    }
    if (!formData.description.trim()) {
      setMessage({ type: 'error', text: '会议描述不能为空' })
      return
    }
    try {
      updateConference(
        { data: { name: formData.name, description: formData.description, status: formData.status } },
        {
          onSuccess: () => { setMessage({ type: 'success', text: '会议信息更新成功' }); setIsEditing(false) },
          onError: () => { setMessage({ type: 'error', text: '更新失败，请重试' }) }
        }
      )
    } catch {
      setMessage({ type: 'error', text: '更新失败，请重试' })
    }
  }

  if (authLoading || conferenceLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-screen">
          <p className="text-lg text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!canManageConference) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">会议信息</h1>

        {/* 会议信息卡片 */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>会议信息</CardTitle>
                <CardDescription>查看和编辑当前会议信息</CardDescription>
              </div>
              {conference && (
                <Button onClick={handleEdit}>编辑</Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!conference ? (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p className="text-sm text-yellow-900">当前没有关联会议</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">会议名称</Label>
                  <p className="text-sm font-medium">{conference.name}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 编辑会议信息弹窗 */}
        <Dialog open={isEditing} onOpenChange={(open) => { if (!open) handleCancel() }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>编辑会议信息</DialogTitle>
              <DialogDescription>修改会议名称、描述和状态</DialogDescription>
            </DialogHeader>
            {message && (
              <div className={`p-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-900 border border-green-200'
                  : 'bg-red-50 text-red-900 border border-red-200'
              }`}>
                {message.text}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">会议名称</Label>
                <Input
                  id="edit-name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="输入会议名称"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">会议描述</Label>
                <Textarea
                  id="edit-description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="输入会议描述"
                  className="mt-2"
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="edit-status">会议状态</Label>
                <select
                  id="edit-status"
                  value={formData.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 mt-2"
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCancel}>取消</Button>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? '保存中...' : '保存修改'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* 用户组管理 + 代表管理 左右并排 */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
            {/* 用户组管理 */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>用户组管理</CardTitle>
                    <CardDescription>创建和管理用户分组</CardDescription>
                  </div>
                  <Button size="sm" onClick={openCreateGroupForm}>新建用户组</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupsLoading ? (
                  <p className="text-sm text-muted-foreground">加载中...</p>
                ) : groupsError ? (
                  <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                    <p className="text-sm text-red-900 font-semibold">加载用户组失败，请查看控制台日志</p>
                  </div>
                ) : (<>
                {showGroupForm && (
                  <div className="flex gap-2 items-center p-3 bg-muted/50 rounded-lg">
                    <Input
                      value={groupNameInput}
                      onChange={e => setGroupNameInput(e.target.value)}
                      placeholder="输入用户组名称"
                      className="flex-1"
                      onKeyDown={e => e.key === 'Enter' && handleSaveGroup()}
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveGroup}
                      disabled={isCreatingGroup || isUpdatingGroup || !groupNameInput.trim()}
                    >
                      {isCreatingGroup || isUpdatingGroup ? '保存中...' : '保存'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowGroupForm(false); setEditingGroup(null) }}>
                      取消
                    </Button>
                  </div>
                )}

                {groups.length === 0 && !showGroupForm ? (
                  <p className="text-sm text-muted-foreground">暂无用户组，点击「新建用户组」创建</p>
                ) : (
                  groups.map(group => (
                    <DroppableGroupCard
                      key={group.id}
                      group={group}
                      onOpenMemberManagement={openMemberManagement}
                      onOpenEditGroupForm={openEditGroupForm}
                      onDeleteGroup={(id) => setDeletingGroupId(id)}
                    >
                      <div>
                        <p className="font-medium text-sm">{group.groupName}</p>
                        <p className="text-xs text-muted-foreground">{group.userUuids.length} 名成员</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openMemberManagement(group)}>
                          管理成员
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEditGroupForm(group)}>
                          编辑
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeletingGroupId(group.id)}
                        >
                          删除
                        </Button>
                      </div>
                    </DroppableGroupCard>
                  ))
                )}
                </>)}
              </CardContent>
            </Card>

            {/* 代表管理 */}
            {canManageConference && conference && (
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>代表管理</CardTitle>
                      <CardDescription>查看、批量注册和管理当前会议的代表</CardDescription>
                    </div>
                    {canManageDelegates && (
                      <Button
                        variant="outline"
                        onClick={handleOpenBatchDialog}
                      >
                        批量注册
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {delegatesLoading ? (
                    <p className="text-sm text-muted-foreground">加载中...</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg border">
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground">
                              <tr>
                                <th className="py-3 px-4 text-left font-medium">
                                  <div className="min-w-40 space-y-2">
                                    <div>用户昵称</div>
                                    <Input
                                      value={delegateNameFilter}
                                      onChange={(e) => setDelegateNameFilter(e.target.value)}
                                      placeholder="全部"
                                      className="h-9 bg-background"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          setDelegatePage(0)
                                          setAppliedDelegateNameFilter(delegateNameFilter)
                                        }
                                      }}
                                    />
                                  </div>
                                </th>
                                <th className="py-3 px-4 text-left font-medium">显示名称</th>
                                <th className="py-3 px-4 text-right font-medium">
                                  <div className="flex flex-col items-end gap-2">
                                    <div>操作</div>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setDelegateNameFilter('')
                                          setDelegatePage(0)
                                          setAppliedDelegateNameFilter('')
                                        }}
                                      >
                                        重置
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          setDelegatePage(0)
                                          setAppliedDelegateNameFilter(delegateNameFilter)
                                        }}
                                      >
                                        查询
                                      </Button>
                                    </div>
                                  </div>
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {delegates.length === 0 ? (
                                <tr>
                                  <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                                    暂无代表数据
                                  </td>
                                </tr>
                              ) : (
                                delegates.map((d) => (
                                  <DraggableUserRow
                                    key={d.uuid}
                                    user={d}
                                    getUserLabel={getUserLabel}
                                    onDetailStart={handleDetailStart}
                                    onResetPasswordStart={handleResetPasswordStart}
                                    canManageDelegates={canManageDelegates}
                                  />
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                          第 {Math.min(delegatePage + 1, Math.max(totalDelegatePages, 1))} 页，共 {Math.max(totalDelegatePages, 1)} 页，共 {totalDelegateElements} 位代表
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setDelegatePage(prev => Math.max(prev - 1, 0))}
                            disabled={delegatePage === 0}
                          >
                            上一页
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setDelegatePage(prev => Math.min(prev + 1, Math.max(totalDelegatePages - 1, 0)))}
                            disabled={totalDelegatePages <= 1 || delegatePage >= totalDelegatePages - 1}
                          >
                            下一页
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          <DragOverlay>
            {activeUser ? (
              <div className="p-3 bg-background border rounded-lg shadow-lg">
                <p className="text-sm font-medium">{getUserLabel(activeUser)}</p>
                <p className="text-xs text-muted-foreground">{roleLabels[activeUser.role] || activeUser.role}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* 删除确认 */}
        <AlertDialog open={deletingGroupId !== null} onOpenChange={open => !open && setDeletingGroupId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除用户组</AlertDialogTitle>
              <AlertDialogDescription>
                删除后将无法恢复，该用户组内的成员关系也会一并清除。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteGroup} disabled={isDeletingGroup}>
                {isDeletingGroup ? '删除中...' : '确认删除'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 管理成员 Dialog */}
        <Dialog
          open={managingGroup !== null}
          onOpenChange={open => {
            if (!open) { setManagingGroup(null); setMemberKeyword('') }
          }}
        >
          <DialogContent className="max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>管理成员 — {managingGroup?.groupName}</DialogTitle>
              <DialogDescription>
                已选 {selectedUuids.length} / {users.length} 名用户
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 flex items-center gap-2">
              <Input
                value={memberKeyword}
                onChange={event => setMemberKeyword(event.target.value)}
                placeholder="输入用户 displayName / name 筛选"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleSelectAllUsers} disabled={users.length === 0}>
                全选
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleClearSelectedUsers} disabled={selectedUuids.length === 0}>
                清空
              </Button>
            </div>

            <div className="mt-4 max-h-[55vh] overflow-y-auto rounded-lg border p-2">
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无用户</p>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map(u => (
                    <label key={u.uuid} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selectedUuids.includes(u.uuid)}
                        onChange={() => toggleUserInGroup(u.uuid)}
                      />
                      <div>
                        <p className="text-sm font-medium">{getUserLabel(u)}</p>
                        <p className="text-xs text-muted-foreground">{roleLabels[u.role as keyof typeof roleLabels] || u.role}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={handleSaveMembers} disabled={isSettingMembers} className="flex-1 sm:flex-none">
                {isSettingMembers ? '保存中...' : '保存成员'}
              </Button>
              <Button variant="outline" onClick={() => { setManagingGroup(null); setMemberKeyword('') }}>
                取消
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 批量注册代表弹窗 */}
        <AlertDialog
          open={batchDialogOpen}
          onOpenChange={(open) => {
            if (open) { setBatchDialogOpen(true) } else { handleCloseBatchDialog() }
          }}
        >
          <AlertDialogContent className="!max-w-5xl !max-h-[90vh] overflow-hidden">
            <AlertDialogHeader>
              <AlertDialogTitle>批量注册代表</AlertDialogTitle>
              <AlertDialogDescription>
                从 CSV 导入或手动填写代表信息，将注册到当前会议「{conference?.name}」。
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4 py-2 max-h-[70vh] overflow-auto px-1 -mx-1">
              <div>
                <Label htmlFor="batch-csv">导入 CSV</Label>
                <Input
                  id="batch-csv"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => handleBatchCsvUpload(e.target.files?.[0])}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-2">CSV 列：name, displayName, password（可带表头）</p>
                {batchCsvError && (
                  <p className="text-xs text-red-600 mt-1">{batchCsvError}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleAddBatchUser}>
                  添加一行
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setBatchUsers([])}
                  disabled={batchUsers.length === 0}
                >
                  清空
                </Button>
                <span className="text-xs text-muted-foreground">共 {batchUsers.length} 人</span>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="!py-3 !px-4 text-left font-medium">用户昵称</th>
                      <th className="!py-3 !px-4 text-left font-medium">显示名称</th>
                      <th className="!py-3 !px-4 text-left font-medium">密码</th>
                      <th className="!py-3 !px-4 text-right font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {batchUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="!py-4 !px-4 text-center text-muted-foreground">
                          暂无数据，可手动添加或从 CSV 导入
                        </td>
                      </tr>
                    ) : (
                      batchUsers.map((u, index) => (
                        <tr key={`batch-user-${index}`}>
                          <td className="!py-3 !px-4">
                            <Input
                              type="text"
                              value={u.name}
                              onChange={(e) => handleBatchUserChange(index, 'name', e.target.value)}
                              placeholder="delegate1"
                            />
                          </td>
                          <td className="!py-3 !px-4">
                            <Input
                              type="text"
                              value={u.displayName || ''}
                              onChange={(e) => handleBatchUserChange(index, 'displayName', e.target.value)}
                              placeholder="显示名称（可选）"
                            />
                          </td>
                          <td className="!py-3 !px-4">
                            <Input
                              type="text"
                              value={u.password}
                              onChange={(e) => handleBatchUserChange(index, 'password', e.target.value)}
                              placeholder="至少 6 位"
                            />
                          </td>
                          <td className="!py-3 !px-4 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveBatchUser(index)}
                            >
                              移除
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCloseBatchDialog}>取消</AlertDialogCancel>
              <Button onClick={handleConfirmBatchRegister} disabled={isBatchRegistering}>
                {isBatchRegistering ? '提交中...' : '确认批量注册'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 重置密码弹窗 */}
        <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>重置用户密码</AlertDialogTitle>
              <AlertDialogDescription>
                为用户「{userToReset?.displayName || userToReset?.name}」设置新密码。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="reset-password">新密码</Label>
                <Input
                  id="reset-password"
                  type="password"
                  value={resetForm.password}
                  onChange={(e) => setResetForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="请输入新密码"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-confirm-password">确认新密码</Label>
                <Input
                  id="reset-confirm-password"
                  type="password"
                  value={resetForm.confirmPassword}
                  onChange={(e) => setResetForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="再次输入新密码"
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmResetPassword} disabled={isResettingPassword}>
                {isResettingPassword ? '重置中...' : '确认重置'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 代表详情弹窗 */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>代表详情</DialogTitle>
              <DialogDescription>
                {detailUser?.displayName || detailUser?.name} 的基本信息
              </DialogDescription>
            </DialogHeader>
            {detailUser && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">用户昵称</span>
                    <p className="font-medium mt-1">{detailUser.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">显示名称</span>
                    <p className="font-medium mt-1">{detailUser.displayName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">角色</span>
                    <p className="font-medium mt-1">{roleLabels[detailUser.role] || detailUser.role}</p>
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">所属用户组</span>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {detailUserGroups.length === 0 ? (
                      <span className="text-xs text-muted-foreground">未分组</span>
                    ) : (
                      detailUserGroups.map(g => (
                        <Badge key={g.id} variant="secondary" className="text-xs">{g.groupName}</Badge>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
