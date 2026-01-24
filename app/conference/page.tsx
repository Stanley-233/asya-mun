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
import { useGetMine, useUpdate, useGetUsers } from "@/lib/api/endpoints/会议管理/会议管理"
import type { ConferenceResponse, ConferenceRequestStatus, UserInfoResponse } from "@/lib/api/endpoints/asyaBackendAPI.schemas"

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
  'DM': '危机指导',
  'DH': '主席'
}

export default function ConferencePage() {
  const router = useRouter()
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const { data: conferenceData, isLoading: conferenceLoading } = useGetMine()
  const { data: usersData, isLoading: usersLoading } = useGetUsers()
  const { mutate: updateConference, isPending: isUpdating } = useUpdate()

  const [conference, setConference] = useState<ConferenceResponse | null>(null)
  const [users, setUsers] = useState<UserInfoResponse[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'PREPARING' as ConferenceRequestStatus
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
      </div>
    </div>
  )
}
