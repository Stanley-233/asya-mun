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
import { useListAll, useUpdateUser } from "@/lib/api/endpoints/用户管理/用户管理"
import { useCreate, useListAll1, useAssignUser } from "@/lib/api/endpoints/会议管理/会议管理"
import type { UserInfoResponse, UserUpdateRequestRole, ConferenceRequestStatus, ConferenceResponse } from "@/lib/api/endpoints/asyaBackendAPI.schemas"

const roleLabels: Record<string, string> = {
  'SYS_ADMIN': '系统管理员',
  'DELEGATE': '代表',
  'DM': '危机指导',
  'DH': '主席'
}

const roleOptions = [
  { value: 'DELEGATE', label: '代表' },
  { value: 'DM', label: '危机指导' },
  { value: 'DH', label: '主席' },
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
  const { data: usersData, isLoading: usersLoading } = useListAll()
  const { data: conferencesData, isLoading: conferencesLoading } = useListAll1()
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser()
  const { mutate: createConference, isPending: isCreating } = useCreate()
  const { mutate: assignUser, isPending: isAssigning } = useAssignUser()

  const [users, setUsers] = useState<UserInfoResponse[]>([])
  const [conferences, setConferences] = useState<ConferenceResponse[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, { name: string; role: UserUpdateRequestRole }>>({})
  const [showCreateConference, setShowCreateConference] = useState(false)
  const [conferenceForm, setConferenceForm] = useState({
    name: '',
    description: '',
    status: 'PREPARING' as ConferenceRequestStatus
  })
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null)
  const [selectedConferenceId, setSelectedConferenceId] = useState<string>('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
          const formData: Record<string, { name: string; role: UserUpdateRequestRole }> = {}
          userArray.forEach((user: UserInfoResponse) => {
            formData[user.uuid] = {
              name: user.name,
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

  const handleEditStart = (userId: string) => {
    setEditingId(userId)
    setMessage(null)
  }

  const handleEditCancel = () => {
    setEditingId(null)
  }

  const handleFieldChange = (userId: string, field: 'name' | 'role', value: string) => {
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
              users.map(user => (
                <Card key={user.uuid}>
                  <CardContent className="pt-6">
                    {editingId === user.uuid ? (
                      // 编辑模式
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`name-${user.uuid}`}>用户昵称</Label>
                            <Input
                              id={`name-${user.uuid}`}
                              type="text"
                              value={editForm[user.uuid]?.name || ''}
                              onChange={(e) => handleFieldChange(user.uuid, 'name', e.target.value)}
                              className="mt-2"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`role-${user.uuid}`}>用户角色</Label>
                            <Select
                              value={editForm[user.uuid]?.role || ''}
                              onValueChange={(value) => handleFieldChange(user.uuid, 'role', value)}
                            >
                              <SelectTrigger id={`role-${user.uuid}`} className="mt-2">
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
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            onClick={handleEditCancel}
                          >
                            取消
                          </Button>
                          <Button
                            onClick={() => handleSave(user.uuid)}
                            disabled={isUpdating}
                          >
                            {isUpdating ? '保存中...' : '保存'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // 显示模式
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">用户ID</p>
                            <p className="font-mono text-sm break-all">{user.uuid}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">用户昵称</p>
                            <p className="text-sm font-medium">{user.name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">用户角色</p>
                            <p className="text-sm font-medium">
                              {roleLabels[user.role] || user.role}
                            </p>
                          </div>
                        </div>
                        {assigningUserId === user.uuid ? (
                          <div className="flex flex-col gap-2">
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
                          <div className="flex gap-2">
                            <Button onClick={() => handleEditStart(user.uuid)}>
                              编辑
                            </Button>
                            <Button variant="outline" onClick={() => handleAssignUser(user.uuid)}>
                              关联会议
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
