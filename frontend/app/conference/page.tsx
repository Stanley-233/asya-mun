'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
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
  useGetUsers
} from "@/lib/api/hooks/conference"
import {
  useGetAllUserGroups,
  useCreateUserGroup,
  useUpdateUserGroup,
  useDeleteUserGroup,
  useSetGroupMembers
} from "@/lib/api/hooks/user-group"
import type {
  ConferenceResponse,
  ConferenceRequestStatus,
  UserInfoResponse,
  UserGroupResponse
} from "@/lib/api/generated"
import { TimelineManager } from '@/components/timeline-manager'
import { RoundManager } from '@/components/round/round-manager'
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

export default function ConferencePage() {
  const router = useRouter()
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()

  const getUserLabel = (targetUser: UserInfoResponse) => {
    const displayName = targetUser.displayName?.trim()
    return displayName ? `${displayName}（${targetUser.name}）` : targetUser.name
  }
  
  // 检查用户权限
  const canManageConference = user?.role === 'DM' || user?.role === 'DH' || user?.role === 'SYS_ADMIN'
  
  const { data: conferenceData, isLoading: conferenceLoading } = useGetMine()
  const { data: usersData, isLoading: usersLoading, error: usersError } = useGetUsers({
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

  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'PREPARING' as ConferenceRequestStatus
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 用户组相关状态
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleStatusChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      status: value as ConferenceRequestStatus
    }))
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
        {
          data: {
            name: formData.name,
            description: formData.description,
            status: formData.status
          }
        },
        {
          onSuccess: () => {
            setMessage({ type: 'success', text: '会议信息更新成功' })
            setIsEditing(false)
          },
          onError: () => {
            setMessage({ type: 'error', text: '更新失败，请重试' })
          }
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
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">会议管理</h1>

        {/* 两栏布局：移动端单栏，桌面端双栏 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左栏：会议管理相关 */}
          <div className="space-y-6">
            {/* 会议信息卡片 */}
            <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>会议信息</CardTitle>
                <CardDescription>查看和编辑当前会议信息</CardDescription>
              </div>
              {!isEditing && conference && (
                <Button onClick={handleEdit}>编辑</Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {message && (
              <div className={`mb-6 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-900 border border-green-200'
                  : 'bg-red-50 text-red-900 border border-red-200'
              }`}>
                {message.text}
              </div>
            )}

            {!conference ? (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p className="text-sm text-yellow-900">当前没有关联会议</p>
              </div>
            ) : isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">会议名称</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="输入会议名称"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="description">会议描述</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="输入会议描述"
                    className="mt-2"
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="status">会议状态</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => handleStatusChange(e.target.value as ConferenceRequestStatus)}
                    className="flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 mt-2"
                  >
                    {statusOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? '保存中...' : '保存修改'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    取消
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                {/* <div>
                  <Label className="text-xs text-muted-foreground">会议ID</Label>
                  <p className="font-mono text-sm break-all">{conference.uuid}</p>
                </div> */}
                <div>
                  <Label className="text-xs text-muted-foreground">会议名称</Label>
                  <p className="text-sm font-medium">{conference.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">会议描述</Label>
                  <p className="text-sm">{conference.description}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">会议状态</Label>
                  <p className="text-sm">
                    {statusLabels[conference.status as keyof typeof statusLabels] || conference.status}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 用户列表 */}
        <Card>
          <CardHeader>
            <CardTitle>会议用户</CardTitle>
            <CardDescription>参与当前会议的所有用户及其所属用户组</CardDescription>
          </CardHeader>
          <CardContent>
            {!conference ? (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p className="text-sm text-yellow-900">请先创建或关联会议</p>
              </div>
            ) : usersLoading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : usersError ? (
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <p className="text-sm text-red-900 font-semibold mb-2">加载用户失败</p>
                <p className="text-xs text-red-800">
                  {String(usersError).includes('no session')
                    ? '后端数据库会话错误，请联系管理员检查后端服务配置'
                    : String(usersError)}
                </p>
              </div>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground">当前会议暂无关联用户</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-4 font-medium">用户名</th>
                      <th className="text-left py-2 pr-4 font-medium">角色</th>
                      <th className="text-left py-2 font-medium">所属用户组</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const userGroups = groups.filter(g => g.userUuids.includes(u.uuid))
                      return (
                        <tr key={u.uuid} className="border-b last:border-0">
                          <td className="py-2 pr-4">
                            <p className="font-medium">{getUserLabel(u)}</p>
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {roleLabels[u.role as keyof typeof roleLabels] || u.role}
                          </td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1">
                              {userGroups.length === 0
                                ? <span className="text-muted-foreground text-xs">未分组</span>
                                : userGroups.map(g => (
                                    <Badge key={g.id} variant="secondary" className="text-xs">{g.groupName}</Badge>
                                  ))
                              }
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

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
            {/* 新建/编辑表单 */}
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
                <div key={group.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
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
                </div>
              ))
            )}
            </>)}
          </CardContent>
        </Card>
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
            if (!open) {
              setManagingGroup(null)
              setMemberKeyword('')
            }
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
              <Button
                variant="outline"
                onClick={() => {
                  setManagingGroup(null)
                  setMemberKeyword('')
                }}
              >
                取消
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
          </div>

          {/* 右栏：时间轴管理 */}
          <div className="space-y-6">
            {/* 时间轴管理 */}
            <TimelineManager />

            {/* 回合管理 */}
            <RoundManager />
          </div>
        </div>
      </div>
    </div>
  )
}
