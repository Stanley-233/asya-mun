'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
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
} from '@/components/ui/select'
import { useAuth } from "@/lib/contexts/auth-context"
import { useUpdateUser } from "@/lib/api/endpoints/用户管理/用户管理"
import { useGetMine } from "@/lib/api/endpoints/会议管理/会议管理"
import { SecretMessageList, MessageDetailDialog } from "@/components/message"
import { InstructionDetailDialog, InstructionList, InstructionSubmitForm } from '@/components/instruction'
import { parseApiPayload } from '@/lib/api/response-utils'
import { buildLoginRedirect } from '@/lib/auth/return-to'
import { useGetMyInstructions, useGetSubmissionSwitch } from '@/lib/api/endpoints/指令管理/指令管理'
import {
  INSTRUCTION_STATUS_LABELS,
  parseInstructionPage,
} from '@/components/instruction/instruction-utils'
import type {
  ConferenceResponse,
  GetMyInstructionsStatus,
  InstructionResponse,
  MessageResponse,
} from "@/lib/api/endpoints/asyaBackendAPI.schemas"

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

const ALL_INSTRUCTION_STATUS = '__ALL__'

const myInstructionStatusOptions: GetMyInstructionsStatus[] = [
  'SUBMITTED',
  'IN_PROGRESS',
  'REJECTED',
  'FEEDBACKED',
]

export default function ProfilePage() {
  const router = useRouter()
  const { user, isLoading, isAuthenticated } = useAuth()
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser()
  const { data: conferenceData, isLoading: conferenceLoading } = useGetMine()
  const canReviewInstructions = user?.role === 'DM' || user?.role === 'DH' || user?.role === 'SYS_ADMIN'
  const canSubmitInstruction = user?.role === 'DELEGATE'

  const [formData, setFormData] = useState({
    password: '',
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedMessageUuid, setSelectedMessageUuid] = useState<string | null>(null)
  const [messageDetailOpen, setMessageDetailOpen] = useState(false)
  const [selectedInstructionUuid, setSelectedInstructionUuid] = useState<string | null>(null)
  const [instructionDetailOpen, setInstructionDetailOpen] = useState(false)
  const [instructionCurrentPage, setInstructionCurrentPage] = useState(0)
  const [instructionStatusFilter, setInstructionStatusFilter] = useState<GetMyInstructionsStatus | undefined>(undefined)

  const { data: myInstructionsData, isLoading: myInstructionsLoading, error: myInstructionsError, refetch: refetchMyInstructions } = useGetMyInstructions(
    {
      status: instructionStatusFilter,
      pageable: {
        page: instructionCurrentPage,
        size: 10,
        sort: ['submitRealTime,desc'],
      },
    },
    {
      query: {
        enabled: isAuthenticated,
      },
    },
  )
  const { data: submissionSwitchData } = useGetSubmissionSwitch({
    query: {
      enabled: isAuthenticated && canSubmitInstruction,
      refetchInterval: 30_000,
      refetchIntervalInBackground: true,
    },
  })

  const parsedInstructionData = parseApiPayload<unknown>(myInstructionsData)
  const instructionPage = parseInstructionPage(parsedInstructionData)
  const conference = useMemo(
    () => parseApiPayload<ConferenceResponse>(conferenceData),
    [conferenceData],
  )
  const instructionSubmissionPaused = useMemo(
    () => parseApiPayload<boolean>(submissionSwitchData),
    [submissionSwitchData],
  )
  const isInstructionSubmissionPaused = !!instructionSubmissionPaused
  const instructionSubmitDisabledReason = !conference
    ? '尚未关联会议，暂时无法提交指令，请联系管理员。'
    : isInstructionSubmissionPaused
      ? '系统已全局暂停指令提交，请等待管理员恢复。'
      : undefined

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(buildLoginRedirect())
    }
  }, [isLoading, isAuthenticated, router])

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
    if (!formData.password) {
      setMessage({ type: 'error', text: '请输入新密码' })
      return
    }
    try {
      updateUser(
        {
          uuid: user.uuid,
          data: {
            password: formData.password,
          }
        },
        {
          onSuccess: () => {
            setMessage({ type: 'success', text: '密码修改成功' })
            setFormData({ password: '' })
          },
          onError: () => {
            setMessage({ type: 'error', text: '密码修改失败，请重试' })
          }
        }
      )
    } catch {
      setMessage({ type: 'error', text: '密码修改失败，请重试' })
    }
  }

  const handleMessageClick = (msg: MessageResponse) => {
    setSelectedMessageUuid(msg.uuid)
    setMessageDetailOpen(true)
  }

  const handleInstructionClick = (instruction: InstructionResponse) => {
    setSelectedInstructionUuid(instruction.uuid)
    setInstructionDetailOpen(true)
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
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>我的指令</CardTitle>
              <CardDescription>查看您在当前会议中的提交记录</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="space-y-2 sm:min-w-56">
                  <Label>状态筛选</Label>
                  <Select
                    value={instructionStatusFilter || ALL_INSTRUCTION_STATUS}
                    onValueChange={value => {
                      setInstructionStatusFilter(
                        value === ALL_INSTRUCTION_STATUS ? undefined : (value as GetMyInstructionsStatus),
                      )
                      setInstructionCurrentPage(0)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="全部状态" />
                    </SelectTrigger>
                    <SelectContent align="start">
                      <SelectItem value={ALL_INSTRUCTION_STATUS}>全部状态</SelectItem>
                      {myInstructionStatusOptions.map(status => (
                        <SelectItem key={status} value={status}>
                          {INSTRUCTION_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setInstructionStatusFilter(undefined)
                    setInstructionCurrentPage(0)
                  }}
                >
                  清空筛选
                </Button>
              </div>

              <InstructionList
                instructions={instructionPage.content}
                isLoading={myInstructionsLoading}
                error={!!myInstructionsError}
                emptyTitle="暂无指令"
                emptyDescription="当前筛选条件下没有符合条件的指令"
                currentPage={instructionCurrentPage}
                totalPages={instructionPage.totalPages}
                isFirstPage={instructionPage.isFirstPage}
                isLastPage={instructionPage.isLastPage}
                onPreviousPage={() => setInstructionCurrentPage(page => Math.max(0, page - 1))}
                onNextPage={() => setInstructionCurrentPage(page => page + 1)}
                onInstructionClick={handleInstructionClick}
              />
            </CardContent>
          </Card>

          {canSubmitInstruction && (
            <InstructionSubmitForm
              disabled={!!instructionSubmitDisabledReason}
              disabledReason={instructionSubmitDisabledReason}
              onSuccess={() => {
                if (instructionCurrentPage === 0) {
                  refetchMyInstructions()
                } else {
                  setInstructionCurrentPage(0)
                }
              }}
            />
          )}
        </div>

        {/* 中间：非对称消息列表 */}
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
      </div>

      <div className="mt-8">
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
              <div className="grid gap-6 xl:grid-cols-2">
                <div>
                <h3 className="text-sm font-semibold mb-4">账户信息</h3>
                <div className="grid gap-4 rounded-lg bg-muted/50 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  {/* <div>
                      <p className="text-xs text-muted-foreground mb-1">用户ID</p>
                      <p className="font-mono text-sm break-all">{user.uuid}</p>
                    </div> */}
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

                <div>
                  <h3 className="text-sm font-semibold mb-4">会议信息</h3>
                  {conferenceLoading ? (
                    <div className="rounded-lg bg-muted/50 p-4">
                      <p className="text-sm text-muted-foreground">加载中...</p>
                    </div>
                  ) : conference ? (
                    <div className="grid gap-4 rounded-lg bg-muted/50 p-4 sm:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">会议名称</Label>
                        <p className="text-sm font-medium">{conference.name}</p>
                      </div>
                      <div className="sm:col-span-2 xl:col-span-1">
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
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                      <p className="text-sm text-yellow-900">尚未关联会议，请联系管理员</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <form onSubmit={handleSubmit} className="rounded-lg border bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold">修改密码</h3>
                  <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="flex-1">
                      <Label htmlFor="password">新密码</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="请输入新密码"
                      className="mt-2"
                    />
                    </div>
                    <div className="md:shrink-0">
                      <Button
                        type="submit"
                        disabled={isUpdating}
                        className="w-full md:w-auto"
                      >
                        {isUpdating ? '保存中...' : '保存密码'}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Message Detail Dialog */}
      <MessageDetailDialog
        open={messageDetailOpen}
        onOpenChange={setMessageDetailOpen}
        messageUuid={selectedMessageUuid}
      />

      <InstructionDetailDialog
        open={instructionDetailOpen}
        onOpenChange={setInstructionDetailOpen}
        instructionUuid={selectedInstructionUuid}
        canReview={canReviewInstructions}
        onReviewed={() => {
          refetchMyInstructions()
        }}
      />
    </div>
  )
}
