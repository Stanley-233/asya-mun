'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/contexts/auth-context"
import { useUpdateUser } from "@/lib/api/endpoints/用户管理/用户管理"
import { useGetMine } from "@/lib/api/endpoints/会议管理/会议管理"
import { SecretMessageList, MessageDetailDialog } from "@/components/message"
import type { ConferenceResponse, MessageResponse } from "@/lib/api/endpoints/asyaBackendAPI.schemas"

const roleLabels = {
  'SYS_ADMIN': '系统管理员',
  'DELEGATE': '代表',
  'DM': '主席团成员',
  'DH': '主席团指导'
}

const statusLabels = {
  'PREPARING': '筹备中',
  'RUNNING': '进行中',
  'COMPLETED': '已结束'
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, isLoading, isAuthenticated } = useAuth()
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser()
  const { data: conferenceData, isLoading: conferenceLoading } = useGetMine()

  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    password: '',
  })
  const [conference, setConference] = useState<ConferenceResponse | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedMessageUuid, setSelectedMessageUuid] = useState<string | null>(null)
  const [messageDetailOpen, setMessageDetailOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        displayName: user.displayName || '',
        password: '',
      })
    }
  }, [user])

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
        }
      } catch (err) {
        console.error('Failed to parse conference data:', err)
        setConference(null)
      }
    }
  }, [conferenceData, conferenceLoading])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user?.uuid) {
      setMessage({ type: 'error', text: '用户信息未加载' })
      return
    }

    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: '用户昵称不能为空' })
      return
    }

    try {
      updateUser(
        {
          uuid: user.uuid,
          data: {
            name: formData.name,
            displayName: formData.displayName,
            ...(formData.password && { password: formData.password }),
          }
        },
        {
          onSuccess: () => {
            setMessage({ type: 'success', text: '个人信息更新成功' })
            setFormData(prev => ({ ...prev, password: '' }))
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

  const handleMessageClick = (msg: MessageResponse) => {
    setSelectedMessageUuid(msg.uuid)
    setMessageDetailOpen(true)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-screen">
          <p className="text-lg text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左侧：非对称消息列表 */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>我的非对称消息</CardTitle>
              <CardDescription>查看您接收的私密消息</CardDescription>
            </CardHeader>
            <CardContent>
              <SecretMessageList onMessageClick={handleMessageClick} />
            </CardContent>
          </Card>
        </div>

        {/* 右侧：个人信息 */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>个人信息</CardTitle>
              <CardDescription>查看和修改您的账户信息</CardDescription>
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

              <div className="space-y-6">
                {/* 用户信息显示 */}
                <div>
                  <h3 className="text-sm font-semibold mb-4">账户信息</h3>
                  <div className="space-y-3 bg-muted/50 p-4 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">用户ID</p>
                      <p className="font-mono text-sm break-all">{user.uuid}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">用户昵称</p>
                      <p className="text-sm font-medium">{user.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">显示名称</p>
                      <p className="text-sm font-medium">{user.displayName || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">用户角色</p>
                      <p className="text-sm font-medium">
                        {roleLabels[user.role as keyof typeof roleLabels] || user.role}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 会议信息显示 */}
                <div>
                  <h3 className="text-sm font-semibold mb-4">会议信息</h3>
                  {conferenceLoading ? (
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">加载中...</p>
                    </div>
                  ) : conference ? (
                    <div className="space-y-3 bg-muted/50 p-4 rounded-lg">
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
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                      <p className="text-sm text-yellow-900">尚未关联会议，请联系管理员</p>
                    </div>
                  )}
                </div>

                {/* 编辑表单 */}
                <div>
                  <form onSubmit={handleSubmit} className="space-y-4">
                  <h3 className="text-sm font-semibold">修改信息</h3>
                  
                  <div>
                    <Label htmlFor="name">用户昵称</Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="输入新的用户昵称"
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="displayName">显示名称</Label>
                    <Input
                      id="displayName"
                      name="displayName"
                      type="text"
                      value={formData.displayName}
                      onChange={handleInputChange}
                      placeholder="用于展示的名称（可选）"
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="password">新密码 (可选)</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="留空表示不修改密码"
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      如果不想修改密码，请留空此字段
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={isUpdating}
                    className="w-full"
                  >
                    {isUpdating ? '保存中...' : '保存修改'}
                  </Button>
                </form>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Message Detail Dialog */}
      <MessageDetailDialog
        open={messageDetailOpen}
        onOpenChange={setMessageDetailOpen}
        messageUuid={selectedMessageUuid}
      />
    </div>
  )
}
