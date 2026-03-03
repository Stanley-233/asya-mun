'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/lib/contexts/auth-context"
import { useListAll1, useUpdateUser, useDeleteUser, useGetRegistrationSwitch, useSetRegistrationSwitch, useResetPassword, useBatchRegister } from "@/lib/api/endpoints/用户管理/用户管理"
import { useCreate, useListAll2, useAssignUser } from "@/lib/api/endpoints/会议管理/会议管理"
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
import type { UserInfoResponse, UserUpdateRequestRole, ConferenceRequestStatus, ConferenceResponse, BatchRegisterUserItem } from "@/lib/api/endpoints/asyaBackendAPI.schemas"

const roleLabels: Record<string, string> = {
  'SYS_ADMIN': '系统管理员',
  'DELEGATE': '代表',
  'DM': '主席团成员',
  'DH': '主席团指导'
}

const roleOptions = [
  { value: 'DELEGATE', label: '代表' },
  { value: 'DM', label: '主席团成员' },
  { value: 'DH', label: '主席团指导' },
  { value: 'SYS_ADMIN', label: '系统管理员' },
]

const statusOptions = [
  { value: 'PREPARING', label: '筹备中' },
  { value: 'RUNNING', label: '进行中' },
  { value: 'COMPLETED', label: '已结束' },
]

export default function AdminPage() {
  const router = useRouter()
  const { isLoading: authLoading, isSysAdmin, isAuthenticated } = useAuth()
  const { data: usersData, isLoading: usersLoading } = useListAll1()
  const { data: conferencesData, isLoading: conferencesLoading } = useListAll2()
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser()
  const { mutate: deleteUser, isPending: isDeleting } = useDeleteUser()
  const { data: registrationSwitchData, isLoading: registrationSwitchLoading, refetch: refetchRegistrationSwitch } = useGetRegistrationSwitch()
  const { mutate: setRegistrationSwitch, isPending: isSettingRegistrationSwitch } = useSetRegistrationSwitch()
  const { mutate: resetPassword, isPending: isResettingPassword } = useResetPassword()
  const { mutate: batchRegister, isPending: isBatchRegistering } = useBatchRegister()
  const { mutate: createConference, isPending: isCreating } = useCreate()
  const { mutate: assignUser, isPending: isAssigning } = useAssignUser()

  const [users, setUsers] = useState<UserInfoResponse[]>([])
  const [conferences, setConferences] = useState<ConferenceResponse[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, { name: string; displayName: string; role: UserUpdateRequestRole }>>({})
  const [showCreateConference, setShowCreateConference] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<UserInfoResponse | null>(null)
  const [conferenceForm, setConferenceForm] = useState({
    name: '',
    description: '',
    status: 'PREPARING' as ConferenceRequestStatus
  })
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null)
  const [selectedConferenceId, setSelectedConferenceId] = useState<string>('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [registrationAllowed, setRegistrationAllowed] = useState<boolean | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [userToReset, setUserToReset] = useState<UserInfoResponse | null>(null)
  const [resetForm, setResetForm] = useState({ password: '', confirmPassword: '' })
  const [columnSpacing, setColumnSpacing] = useState(24)
  const [batchDialogOpen, setBatchDialogOpen] = useState(false)
  const [batchConferenceId, setBatchConferenceId] = useState('')
  const [batchUsers, setBatchUsers] = useState<BatchRegisterUserItem[]>([])
  const [batchCsvError, setBatchCsvError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isSysAdmin)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, isSysAdmin, router])

  useEffect(() => {
    if (usersData && !usersLoading) {
      try {
        const responseData = (usersData as any).data
        if (responseData) {
          const parsedData = typeof responseData === 'string'
            ? JSON.parse(responseData)
            : responseData

          // 提取用户列表
          const usersList = parsedData.data || parsedData
          const userArray = Array.isArray(usersList) ? usersList : []
          setUsers(userArray)

          // 初始化编辑表单
          const formData: Record<string, { name: string; displayName: string; role: UserUpdateRequestRole }> = {}
          userArray.forEach((user: UserInfoResponse) => {
            formData[user.uuid] = {
              name: user.name,
              displayName: user.displayName || '',
              role: user.role as UserUpdateRequestRole
            }
          })
          setEditForm(formData)
        }
      } catch (err) {
        console.error('Failed to parse users data:', err)
        setUsers([])
      }
    }
  }, [usersData, usersLoading])

  useEffect(() => {
    if (conferencesData && !conferencesLoading) {
      try {
        const responseData = (conferencesData as any).data
        if (responseData) {
          const parsedData = typeof responseData === 'string'
            ? JSON.parse(responseData)
            : responseData

          const conferencesList = parsedData.data || parsedData
          const conferenceArray = Array.isArray(conferencesList) ? conferencesList : []
          setConferences(conferenceArray)
        }
      } catch (err) {
        console.error('Failed to parse conferences data:', err)
        setConferences([])
      }
    }
  }, [conferencesData, conferencesLoading])

  useEffect(() => {
    if (!registrationSwitchData) return
    try {
      const responseData = (registrationSwitchData as any).data
      if (!responseData) return
      const parsedData = typeof responseData === 'string' ? JSON.parse(responseData) : responseData
      const allowed = typeof parsedData?.data === 'boolean' ? parsedData.data : parsedData
      if (typeof allowed === 'boolean') {
        setRegistrationAllowed(allowed)
      }
    } catch (err) {
      console.error('Failed to parse registration switch data:', err)
    }
  }, [registrationSwitchData])

  const parseCsvLine = (line: string) => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = !inQuotes
        }
        continue
      }

      if (char === ',' && !inQuotes) {
        result.push(current)
        current = ''
        continue
      }

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
    } catch (error) {
      setBatchCsvError('读取 CSV 失败，请检查文件格式')
    }
  }

  const handleAddBatchUser = () => {
    setBatchUsers(prev => ([
      ...prev,
      { name: '', displayName: '', password: '' }
    ]))
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
    setBatchConferenceId('')
    setBatchUsers([])
    setBatchCsvError(null)
  }

  const handleEditStart = (userId: string) => {
    setEditingId(userId)
    setMessage(null)
  }

  const handleEditCancel = () => {
    setEditingId(null)
  }

  const handleFieldChange = (userId: string, field: 'name' | 'displayName' | 'role', value: string) => {
    setEditForm(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value
      }
    }))
  }

  const handleSave = (userId: string) => {
    const formData = editForm[userId]
    if (!formData || !formData.name.trim()) {
      setMessage({ type: 'error', text: '用户昵称不能为空' })
      return
    }

    updateUser(
      {
        uuid: userId,
        data: {
          name: formData.name,
          displayName: formData.displayName,
          role: formData.role
        }
      },
      {
        onSuccess: () => {
          setEditingId(null)
          setMessage({ type: 'success', text: '用户信息更新成功' })
        },
        onError: () => {
          setMessage({ type: 'error', text: '更新失败，请重试' })
        }
      }
    )
  }

  const handleConferenceInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setConferenceForm(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleConferenceStatusChange = (value: string) => {
    setConferenceForm(prev => ({
      ...prev,
      status: value as ConferenceRequestStatus
    }))
  }

  const handleCreateConference = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!conferenceForm.name.trim()) {
      setMessage({ type: 'error', text: '会议名称不能为空' })
      return
    }

    if (!conferenceForm.description.trim()) {
      setMessage({ type: 'error', text: '会议描述不能为空' })
      return
    }

    try {
      createConference(
        {
          data: {
            name: conferenceForm.name,
            description: conferenceForm.description,
            status: conferenceForm.status
          }
        },
        {
          onSuccess: () => {
            setMessage({ type: 'success', text: '会议创建成功' })
            setShowCreateConference(false)
            setConferenceForm({
              name: '',
              description: '',
              status: 'PREPARING'
            })
          },
          onError: () => {
            setMessage({ type: 'error', text: '创建失败，请重试' })
          }
        }
      )
    } catch (error) {
      setMessage({ type: 'error', text: '创建失败，请重试' })
    }
  }

  const handleCancelCreateConference = () => {
    setShowCreateConference(false)
    setConferenceForm({
      name: '',
      description: '',
      status: 'PREPARING'
    })
    setMessage(null)
  }

  const handleAssignUser = (userId: string) => {
    setAssigningUserId(userId)
    setSelectedConferenceId('')
    setMessage(null)
  }

  const handleCancelAssign = () => {
    setAssigningUserId(null)
    setSelectedConferenceId('')
  }

  const handleConfirmAssign = () => {
    if (!selectedConferenceId) {
      setMessage({ type: 'error', text: '请选择一个会议' })
      return
    }

    if (!assigningUserId) return

    assignUser(
      {
        data: {
          conferenceUuid: selectedConferenceId,
          userUuid: assigningUserId
        }
      },
      {
        onSuccess: () => {
          setMessage({ type: 'success', text: '用户关联会议成功' })
          setAssigningUserId(null)
          setSelectedConferenceId('')
        },
        onError: () => {
          setMessage({ type: 'error', text: '关联失败，请重试' })
        }
      }
    )
  }

  const handleDeleteUser = (user: UserInfoResponse) => {
    setUserToDelete(user)
    setDeleteDialogOpen(true)
  }

  const handleToggleRegistration = (allowed: boolean) => {
    setRegistrationSwitch(
      { params: { allowed } },
      {
        onSuccess: () => {
          setRegistrationAllowed(allowed)
          refetchRegistrationSwitch()
          setMessage({ type: 'success', text: allowed ? '已开启注册' : '已关闭注册' })
        },
        onError: () => {
          setMessage({ type: 'error', text: '操作失败，请重试' })
        }
      }
    )
  }

  const handleResetPasswordStart = (user: UserInfoResponse) => {
    setUserToReset(user)
    setResetForm({ password: '', confirmPassword: '' })
    setResetDialogOpen(true)
  }

  const handleConfirmResetPassword = () => {
    if (!userToReset) return

    if (!resetForm.password || !resetForm.confirmPassword) {
      setMessage({ type: 'error', text: '请填写新密码并确认' })
      return
    }

    if (resetForm.password !== resetForm.confirmPassword) {
      setMessage({ type: 'error', text: '两次输入的密码不一致' })
      return
    }

    if (resetForm.password.length < 6) {
      setMessage({ type: 'error', text: '密码长度不少于 6 个字符' })
      return
    }

    resetPassword(
      { uuid: userToReset.uuid, data: { password: resetForm.password } },
      {
        onSuccess: () => {
          setMessage({ type: 'success', text: '密码重置成功' })
          setResetDialogOpen(false)
          setUserToReset(null)
          setResetForm({ password: '', confirmPassword: '' })
        },
        onError: () => {
          setMessage({ type: 'error', text: '重置失败，请重试' })
        }
      }
    )
  }

  const handleConfirmBatchRegister = () => {
    if (!batchConferenceId) {
      setMessage({ type: 'error', text: '请选择会议' })
      return
    }

    if (batchUsers.length === 0) {
      setMessage({ type: 'error', text: '请添加至少一位代表' })
      return
    }

    const sanitizedUsers = batchUsers.map(user => ({
      name: user.name.trim(),
      displayName: user.displayName?.trim() || '',
      password: user.password.trim(),
    }))

    const hasInvalid = sanitizedUsers.some(user => !user.name || !user.password)
    if (hasInvalid) {
      setMessage({ type: 'error', text: '用户昵称和密码不能为空' })
      return
    }

    batchRegister(
      {
        data: {
          conferenceId: batchConferenceId,
          users: sanitizedUsers,
        },
      },
      {
        onSuccess: () => {
          setMessage({ type: 'success', text: `批量注册成功（${sanitizedUsers.length} 人）` })
          handleCloseBatchDialog()
        },
        onError: () => {
          setMessage({ type: 'error', text: '批量注册失败，请重试' })
        },
      }
    )
  }

  const handleConfirmDelete = () => {
    if (!userToDelete) return
    
    deleteUser(
      { uuid: userToDelete.uuid },
      {
        onSuccess: () => {
          setMessage({ type: 'success', text: '用户删除成功' })
          setDeleteDialogOpen(false)
          setUserToDelete(null)
          // 刷新用户列表会自动完成（因为 useListAll 会重新获取）
        },
        onError: () => {
          setMessage({ type: 'error', text: '删除失败，请重试' })
          setDeleteDialogOpen(false)
          setUserToDelete(null)
        }
      }
    )
  }

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-screen">
          <p className="text-lg text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isSysAdmin) {
    return null
  }

  const cellPaddingStyle = {
    paddingLeft: columnSpacing / 2,
    paddingRight: columnSpacing / 2
  }

  const getUserConferenceLabel = (user: UserInfoResponse) => {
    const userWithConference = user as UserInfoResponse & {
      conferenceId?: string
      conferenceUuid?: string
      conferenceName?: string
    }

    if (userWithConference.conferenceName) {
      return userWithConference.conferenceName
    }

    const conferenceId = userWithConference.conferenceId || userWithConference.conferenceUuid
    if (!conferenceId) return '未关联'

    const matched = conferences.find(conf => conf.uuid === conferenceId)
    return matched?.name || '未关联'
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">系统管理</h1>
          <p className="text-muted-foreground mb-6">管理系统中的所有用户和会议</p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-900 border border-green-200'
              : 'bg-red-50 text-red-900 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* 注册开关 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>注册开关</CardTitle>
                <CardDescription>
                  {registrationSwitchLoading || registrationAllowed === null
                    ? '正在获取当前状态...'
                    : registrationAllowed
                      ? '当前允许注册'
                      : '当前禁止注册'}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={registrationAllowed ? 'outline' : 'default'}
                  onClick={() => handleToggleRegistration(true)}
                  disabled={registrationSwitchLoading || registrationAllowed === true || isSettingRegistrationSwitch}
                >
                  开启注册
                </Button>
                <Button
                  variant={!registrationAllowed ? 'outline' : 'default'}
                  onClick={() => handleToggleRegistration(false)}
                  disabled={registrationSwitchLoading || registrationAllowed === false || isSettingRegistrationSwitch}
                >
                  关闭注册
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 新建会议卡片 */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>会议管理</CardTitle>
                <CardDescription>创建新的会议</CardDescription>
              </div>
              {!showCreateConference && (
                <Button onClick={() => setShowCreateConference(true)}>
                  新建会议
                </Button>
              )}
            </div>
          </CardHeader>
          {showCreateConference && (
            <CardContent>
              <form onSubmit={handleCreateConference} className="space-y-4">
                <div>
                  <Label htmlFor="conference-name">会议名称</Label>
                  <Input
                    id="conference-name"
                    name="name"
                    type="text"
                    value={conferenceForm.name}
                    onChange={handleConferenceInputChange}
                    placeholder="输入会议名称"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="conference-description">会议描述</Label>
                  <Textarea
                    id="conference-description"
                    name="description"
                    value={conferenceForm.description}
                    onChange={handleConferenceInputChange}
                    placeholder="输入会议描述"
                    className="mt-2"
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="conference-status">会议状态</Label>
                  <Select 
                    value={conferenceForm.status} 
                    onValueChange={handleConferenceStatusChange}
                  >
                    <SelectTrigger id="conference-status" className="mt-2">
                      <SelectValue placeholder="选择会议状态" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? '创建中...' : '创建会议'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancelCreateConference}>
                    取消
                  </Button>
                </div>
              </form>
            </CardContent>
          )}
        </Card>

        {/* 用户管理 */}
        <div>
          <h2 className="text-2xl font-bold mb-4">用户管理</h2>

        {usersLoading ? (
          <div className="flex justify-center items-center min-h-64">
            <p className="text-lg text-muted-foreground">加载用户列表中...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {users.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">暂无用户数据</p>
                </CardContent>
              </Card>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th style={cellPaddingStyle} className="py-3 text-left font-medium">用户昵称</th>
                      <th style={cellPaddingStyle} className="py-3 text-left font-medium">显示名称</th>
                      <th style={cellPaddingStyle} className="py-3 text-left font-medium">关联会议</th>
                      <th style={cellPaddingStyle} className="py-3 text-left font-medium">用户角色</th>
                      <th style={cellPaddingStyle} className="py-3 text-right font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map(user => (
                      <tr key={user.uuid} className="align-top">
                        {editingId === user.uuid ? (
                          <>
                            <td style={cellPaddingStyle} className="py-4">
                              <Input
                                id={`name-${user.uuid}`}
                                type="text"
                                value={editForm[user.uuid]?.name || ''}
                                onChange={(e) => handleFieldChange(user.uuid, 'name', e.target.value)}
                              />
                            </td>
                            <td style={cellPaddingStyle} className="py-4">
                              <Input
                                id={`displayName-${user.uuid}`}
                                type="text"
                                value={editForm[user.uuid]?.displayName || ''}
                                onChange={(e) => handleFieldChange(user.uuid, 'displayName', e.target.value)}
                                placeholder="用于展示的名称（可选）"
                              />
                            </td>
                            <td style={cellPaddingStyle} className="py-4 text-sm text-muted-foreground">
                              {user.conferenceName || '未关联'}
                            </td>
                            <td style={cellPaddingStyle} className="py-4">
                              <Select
                                value={editForm[user.uuid]?.role || ''}
                                onValueChange={(value) => handleFieldChange(user.uuid, 'role', value)}
                              >
                                <SelectTrigger id={`role-${user.uuid}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {roleOptions.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td style={cellPaddingStyle} className="py-4">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button variant="outline" onClick={handleEditCancel}>
                                  取消
                                </Button>
                                <Button onClick={() => handleSave(user.uuid)} disabled={isUpdating}>
                                  {isUpdating ? '保存中...' : '保存'}
                                </Button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={cellPaddingStyle} className="py-4 font-medium">
                              {user.name}
                            </td>
                            <td style={cellPaddingStyle} className="py-4">
                              {user.displayName || '—'}
                            </td>
                            <td style={cellPaddingStyle} className="py-4 text-sm text-muted-foreground">
                              {user.conferenceName || '未关联'}
                            </td>
                            <td style={cellPaddingStyle} className="py-4">
                              {roleLabels[user.role] || user.role}
                            </td>
                            <td style={cellPaddingStyle} className="py-4">
                              {assigningUserId === user.uuid ? (
                                <div className="flex flex-col gap-2 items-end">
                                  <Select value={selectedConferenceId} onValueChange={setSelectedConferenceId}>
                                    <SelectTrigger className="w-[200px]">
                                      <SelectValue placeholder="选择会议" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {conferences.map(conf => (
                                        <SelectItem key={conf.uuid} value={conf.uuid}>
                                          {conf.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={handleConfirmAssign} disabled={isAssigning}>
                                      {isAssigning ? '关联中...' : '确认'}
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={handleCancelAssign}>
                                      取消
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-wrap justify-end gap-2">
                                  <Button onClick={() => handleEditStart(user.uuid)}>
                                    编辑
                                  </Button>
                                  <Button variant="secondary" onClick={() => handleResetPasswordStart(user)}>
                                    重置密码
                                  </Button>
                                  <Button variant="outline" onClick={() => handleAssignUser(user.uuid)}>
                                    关联会议
                                  </Button>
                                  <Button variant="destructive" onClick={() => handleDeleteUser(user)}>
                                    删除
                                  </Button>
                                </div>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
      
      {/* 批量注册代表弹窗 */}
      <AlertDialog
        open={batchDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setBatchDialogOpen(true)
          } else {
            handleCloseBatchDialog()
          }
        }}
      >
        <AlertDialogContent className="!max-w-5xl !max-h-[90vh] overflow-hidden">
          <AlertDialogHeader>
            <AlertDialogTitle>批量注册代表</AlertDialogTitle>
            <AlertDialogDescription>
              选择会议并填写代表信息，可从 CSV 导入并在表格中调整。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2 max-h-[70vh] overflow-auto px-1 -mx-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="batch-conference">关联会议</Label>
                <Select value={batchConferenceId} onValueChange={setBatchConferenceId}>
                  <SelectTrigger id="batch-conference" className="mt-2">
                    <SelectValue placeholder="请选择会议" />
                  </SelectTrigger>
                  <SelectContent>
                    {conferences.map(conf => (
                      <SelectItem key={conf.uuid} value={conf.uuid}>
                        {conf.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                    batchUsers.map((user, index) => (
                      <tr key={`batch-user-${index}`}>
                        <td className="!py-3 !px-4">
                          <Input
                            type="text"
                            value={user.name}
                            onChange={(e) => handleBatchUserChange(index, 'name', e.target.value)}
                            placeholder="delegate1"
                          />
                        </td>
                        <td className="!py-3 !px-4">
                          <Input
                            type="text"
                            value={user.displayName || ''}
                            onChange={(e) => handleBatchUserChange(index, 'displayName', e.target.value)}
                            placeholder="显示名称（可选）"
                          />
                        </td>
                        <td className="!py-3 !px-4">
                          <Input
                            type="text"
                            value={user.password}
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

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除用户</AlertDialogTitle>
            <AlertDialogDescription>
              你确定要删除用户「{userToDelete?.displayName || userToDelete?.name}」(ID: {userToDelete?.uuid}) 吗？此操作无法撤销。
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

      {/* 重置密码弹窗 */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重置用户密码</AlertDialogTitle>
            <AlertDialogDescription>
              为用户「{userToReset?.displayName || userToReset?.name}」(ID: {userToReset?.uuid}) 设置新密码。
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
    </div>
  )
}
