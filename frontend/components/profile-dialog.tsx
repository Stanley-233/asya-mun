'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/contexts/auth-context'
import { useUpdateUser } from '@/lib/api/hooks/user'
import { useGetMine } from '@/lib/api/hooks/conference'
import { useMemo } from 'react'

const roleLabels: Record<string, string> = {
  SYS_ADMIN: '系统管理员',
  DELEGATE: '代表',
  DM: '主席团成员',
  DH: '主席团指导',
}

const statusLabels: Record<string, string> = {
  PREPARING: '筹备中',
  RUNNING: '进行中',
  COMPLETED: '已结束',
}

export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser()
  const { data: conferenceData, isLoading: conferenceLoading } = useGetMine()
  const conference = useMemo(() => conferenceData ?? null, [conferenceData])

  const [formData, setFormData] = useState({ password: '' })
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.uuid) {
      setMessage({ type: 'error', text: '用户信息未加载' })
      return
    }
    if (!formData.password) {
      setMessage({ type: 'error', text: '请输入新密码' })
      return
    }
    updateUser(
      { uuid: user.uuid, data: { password: formData.password } },
      {
        onSuccess: () => {
          setMessage({ type: 'success', text: '密码修改成功' })
          setFormData({ password: '' })
        },
        onError: () => {
          setMessage({ type: 'error', text: '密码修改失败，请重试' })
        },
      },
    )
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pr-8">
          <DialogTitle>个人信息</DialogTitle>
          <DialogDescription>查看和修改您的账户信息</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {message && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                message.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-900'
                  : 'border-red-200 bg-red-50 text-red-900'
              }`}
            >
              {message.text}
            </div>
          )}

          <div>
            <h4 className="mb-2 text-sm font-semibold">账户信息</h4>
            <div className="grid gap-4 rounded-lg bg-muted/50 p-4 sm:grid-cols-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">用户昵称</p>
                <p className="mt-1 break-all text-sm font-medium leading-6">{user.name}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">显示名称</p>
                <p className="mt-1 break-all text-sm font-medium leading-6">{user.displayName || '—'}</p>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <p className="text-xs text-muted-foreground">用户角色</p>
                <p className="mt-1 text-sm font-medium leading-6">
                  {roleLabels[user.role as keyof typeof roleLabels] || user.role}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold">会议信息</h4>
            {conferenceLoading ? (
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">加载中...</p>
              </div>
            ) : conference ? (
              <div className="grid gap-4 rounded-lg bg-muted/50 p-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <Label className="text-xs text-muted-foreground">会议名称</Label>
                  <p className="mt-1 break-words text-sm font-medium leading-6">{conference.name}</p>
                </div>
                <div className="min-w-0">
                  <Label className="text-xs text-muted-foreground">会议状态</Label>
                  <p className="mt-1 text-sm leading-6">
                    {statusLabels[conference.status as keyof typeof statusLabels] || conference.status}
                  </p>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">会议描述</Label>
                  <p className="mt-1 break-words text-sm leading-6">{conference.description}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <p className="text-sm text-yellow-900">尚未关联会议，请联系管理员</p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="rounded-lg border bg-muted/20 p-4">
            <h4 className="text-sm font-semibold">修改密码</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="min-w-0">
                <Label htmlFor="dialog-password">新密码</Label>
                <Input
                  id="dialog-password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="请输入新密码"
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" disabled={isUpdating} className="w-full sm:w-auto">
                {isUpdating ? '保存中...' : '保存密码'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
