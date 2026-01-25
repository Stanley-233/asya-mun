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
import { 
  useGetMine, 
  useUpdate, 
  useGetUsers,
  useListSessions,
  useCreateSession,
  useUpdateSession,
  useUpdateCurrentSession
} from "@/lib/api/endpoints/会议管理/会议管理"
import type { 
  ConferenceResponse, 
  ConferenceRequestStatus, 
  UserInfoResponse,
  ConferenceSessionResponse,
  ConferenceSessionRequestStatus
} from "@/lib/api/endpoints/asyaBackendAPI.schemas"

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

const sessionStatusLabels = {
  'PREPARE': '准备中',
  'RUNNING': '进行中',
  'PAUSED': '暂停',
  'ENDED': '已结束'
}

const sessionStatusOptions = [
  { value: 'PREPARE', label: '准备中' },
  { value: 'RUNNING', label: '进行中' },
  { value: 'PAUSED', label: '暂停' },
  { value: 'ENDED', label: '已结束' },
]

const roleLabels: Record<string, string> = {
  'SYS_ADMIN': '系统管理员',
  'DELEGATE': '代表',
  'DM': '危机指导',
  'DH': '主席'
}

export default function ConferencePage() {
  const router = useRouter()
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const { data: conferenceData, isLoading: conferenceLoading } = useGetMine()
  const { data: usersData, isLoading: usersLoading } = useGetUsers()
  const { data: sessionsData, isLoading: sessionsLoading, refetch: refetchSessions } = useListSessions()
  const { mutate: updateConference, isPending: isUpdating } = useUpdate()
  const { mutate: createSession, isPending: isCreating } = useCreateSession()
  const { mutate: updateSession, isPending: isUpdatingSession } = useUpdateSession()
  const { mutate: setCurrentSession, isPending: isSettingCurrent } = useUpdateCurrentSession()

  const [conference, setConference] = useState<ConferenceResponse | null>(null)
  const [users, setUsers] = useState<UserInfoResponse[]>([])
  const [sessions, setSessions] = useState<ConferenceSessionResponse[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [editingSessionUuid, setEditingSessionUuid] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'PREPARING' as ConferenceRequestStatus
  })
  const [sessionFormData, setSessionFormData] = useState({
    name: '',
    description: '',
    status: 'PREPARE' as ConferenceSessionRequestStatus
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 检查用户权限
  const canManageConference = user?.role === 'DM' || user?.role === 'DH' || user?.role === 'SYS_ADMIN'

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !canManageConference)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, canManageConference, router])

  useEffect(() => {
    if (conferenceData && !conferenceLoading) {
      try {
        const responseData = (conferenceData as any).data
        if (responseData) {
          const parsedData = typeof responseData === 'string' 
            ? JSON.parse(responseData) 
            : responseData
          
          const conferenceInfo = parsedData.data || parsedData
          setConference(conferenceInfo)
          setFormData({
            name: conferenceInfo.name || '',
            description: conferenceInfo.description || '',
            status: conferenceInfo.status || 'PREPARING'
          })
        }
      } catch (err) {
        console.error('Failed to parse conference data:', err)
        setConference(null)
      }
    }
  }, [conferenceData, conferenceLoading])

  useEffect(() => {
    if (usersData && !usersLoading) {
      try {
        const responseData = (usersData as any).data
        if (responseData) {
          const parsedData = typeof responseData === 'string'
            ? JSON.parse(responseData)
            : responseData

          const usersList = parsedData.data || parsedData
          const userArray = Array.isArray(usersList) ? usersList : []
          setUsers(userArray)
        }
      } catch (err) {
        console.error('Failed to parse users data:', err)
        setUsers([])
      }
    }
  }, [usersData, usersLoading])

  useEffect(() => {
    if (sessionsData && !sessionsLoading) {
      try {
        const responseData = (sessionsData as any).data
        if (responseData) {
          const parsedData = typeof responseData === 'string'
            ? JSON.parse(responseData)
            : responseData

          const sessionsList = parsedData.data || parsedData
          const sessionsArray = Array.isArray(sessionsList) ? sessionsList : []
          setSessions(sessionsArray)
        }
      } catch (err) {
        console.error('Failed to parse sessions data:', err)
        setSessions([])
      }
    }
  }, [sessionsData, sessionsLoading])

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

  const handleSessionInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setSessionFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSessionStatusChange = (value: string) => {
    setSessionFormData(prev => ({
      ...prev,
      status: value as ConferenceSessionRequestStatus
    }))
  }

  const handleCreateSession = () => {
    setIsCreatingSession(true)
    setSessionFormData({
      name: '',
      description: '',
      status: 'PREPARE'
    })
    setMessage(null)
  }

  const handleEditSession = (session: ConferenceSessionResponse) => {
    setEditingSessionUuid(session.uuid)
    setSessionFormData({
      name: session.name,
      description: session.description || '',
      status: session.status
    })
    setMessage(null)
  }

  const handleCancelSessionEdit = () => {
    setIsCreatingSession(false)
    setEditingSessionUuid(null)
    setSessionFormData({
      name: '',
      description: '',
      status: 'PREPARE'
    })
    setMessage(null)
  }

  const handleSubmitSession = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!sessionFormData.name.trim()) {
      setMessage({ type: 'error', text: '会期名称不能为空' })
      return
    }

    try {
      if (editingSessionUuid) {
        // 修改会期
        updateSession(
          {
            sessionUuid: editingSessionUuid,
            data: {
              name: sessionFormData.name,
              description: sessionFormData.description,
              status: sessionFormData.status
            }
          },
          {
            onSuccess: () => {
              setMessage({ type: 'success', text: '会期信息更新成功' })
              setEditingSessionUuid(null)
              setSessionFormData({ name: '', description: '', status: 'PREPARE' })
              refetchSessions()
            },
            onError: () => {
              setMessage({ type: 'error', text: '会期更新失败，请重试' })
            }
          }
        )
      } else {
        // 创建会期
        createSession(
          {
            data: {
              name: sessionFormData.name,
              description: sessionFormData.description,
              status: sessionFormData.status
            }
          },
          {
            onSuccess: () => {
              setMessage({ type: 'success', text: '会期创建成功' })
              setIsCreatingSession(false)
              setSessionFormData({ name: '', description: '', status: 'PREPARE' })
              refetchSessions()
            },
            onError: () => {
              setMessage({ type: 'error', text: '会期创建失败，请重试' })
            }
          }
        )
      }
    } catch (error) {
      setMessage({ type: 'error', text: '操作失败，请重试' })
    }
  }

  const handleSetCurrentSession = (sessionUuid: string) => {
    setCurrentSession(
      { sessionUuid },
      {
        onSuccess: () => {
          setMessage({ type: 'success', text: '当前会期设置成功' })
          refetchSessions()
        },
        onError: () => {
          setMessage({ type: 'error', text: '设置当前会期失败，请重试' })
        }
      }
    )
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
          onError: (error) => {
            setMessage({ type: 'error', text: '更新失败，请重试' })
          }
        }
      )
    } catch (error) {
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
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">会议管理</h1>

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
                  <Select value={formData.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="mt-2">
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
                <div>
                  <Label className="text-xs text-muted-foreground">会议ID</Label>
                  <p className="font-mono text-sm break-all">{conference.uuid}</p>
                </div>
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

        {/* 会议关联用户卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>会议关联用户</CardTitle>
            <CardDescription>查看参与当前会议的所有用户</CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground">当前会议暂无关联用户</p>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.uuid} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground font-mono">{user.uuid}</p>
                    </div>
                    <div className="text-sm font-medium">
                      {roleLabels[user.role as keyof typeof roleLabels] || user.role}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 会期管理卡片 */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>会期管理</CardTitle>
                <CardDescription>管理会议的所有会期</CardDescription>
              </div>
              {!isCreatingSession && !editingSessionUuid && (
                <Button onClick={handleCreateSession}>创建会期</Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* 创建/编辑会期表单 */}
            {(isCreatingSession || editingSessionUuid) && (
              <form onSubmit={handleSubmitSession} className="mb-6 p-4 border rounded-lg space-y-4">
                <h3 className="font-semibold text-lg">
                  {editingSessionUuid ? '编辑会期' : '创建新会期'}
                </h3>
                <div>
                  <Label htmlFor="session-name">会期名称</Label>
                  <Input
                    id="session-name"
                    name="name"
                    type="text"
                    value={sessionFormData.name}
                    onChange={handleSessionInputChange}
                    placeholder="输入会期名称"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="session-description">会期描述</Label>
                  <Textarea
                    id="session-description"
                    name="description"
                    value={sessionFormData.description}
                    onChange={handleSessionInputChange}
                    placeholder="输入会期描述（可选）"
                    className="mt-2"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="session-status">会期状态</Label>
                  <Select value={sessionFormData.status} onValueChange={handleSessionStatusChange}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="选择会期状态" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessionStatusOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={isCreating || isUpdatingSession}>
                    {isCreating || isUpdatingSession ? '保存中...' : '保存'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancelSessionEdit}>
                    取消
                  </Button>
                </div>
              </form>
            )}

            {/* 会期列表 */}
            {sessionsLoading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">当前会议暂无会期</p>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div key={session.uuid} className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-base">{session.name}</h4>
                        {session.description && (
                          <p className="text-sm text-muted-foreground mt-1">{session.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground font-mono mt-1">{session.uuid}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          session.status === 'RUNNING' 
                            ? 'bg-green-100 text-green-800' 
                            : session.status === 'PAUSED'
                            ? 'bg-yellow-100 text-yellow-800'
                            : session.status === 'ENDED'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {sessionStatusLabels[session.status as keyof typeof sessionStatusLabels] || session.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleEditSession(session)}
                        disabled={editingSessionUuid !== null || isCreatingSession}
                      >
                        编辑
                      </Button>
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={() => handleSetCurrentSession(session.uuid)}
                        disabled={isSettingCurrent || conference?.currentSession?.uuid === session.uuid}
                      >
                        {conference?.currentSession?.uuid === session.uuid ? '当前会期' : '设为当前'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
