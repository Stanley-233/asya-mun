'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/lib/contexts/auth-context"
import { useListAll, useUpdateUser } from "@/lib/api/endpoints/用户管理/用户管理"
import type { UserInfoResponse, UserUpdateRequestRole } from "@/lib/api/endpoints/asyaBackendAPI.schemas"

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

export default function AdminPage() {
  const router = useRouter()
  const { isLoading: authLoading, isSysAdmin, isAuthenticated } = useAuth()
  const { data: usersData, isLoading: usersLoading } = useListAll()
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser()

  const [users, setUsers] = useState<UserInfoResponse[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, { name: string; role: UserUpdateRequestRole }>>({})
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
      <div>
        <h1 className="text-3xl font-bold mb-2">系统管理</h1>
        <p className="text-muted-foreground mb-6">管理系统中的所有用户</p>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-900 border border-green-200'
              : 'bg-red-50 text-red-900 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

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
                            <p className="text-xs text-muted-foreground">用户ID</p>
                            <p className="font-mono text-sm break-all">{user.uuid}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">用户昵称</p>
                            <p className="text-sm font-medium">{user.name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">用户角色</p>
                            <p className="text-sm font-medium">
                              {roleLabels[user.role] || user.role}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleEditStart(user.uuid)}
                        >
                          编辑
                        </Button>
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
  )
}
