'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { InstructionDetailDialog, InstructionList } from '@/components/instruction'
import {
  INSTRUCTION_STATUS_LABELS,
  INSTRUCTION_TYPE_LABELS,
  parseInstructionPage,
} from '@/components/instruction/instruction-utils'
import { parseApiPayload } from '@/lib/api/response-utils'
import { useAuth } from '@/lib/contexts/auth-context'
import {
  getGetSubmissionSwitchQueryKey,
  useGetForManagement,
  useGetSubmissionSwitch,
  useSetSubmissionSwitch,
} from '@/lib/api/endpoints/指令管理/指令管理'
import { useGetAllUserGroups } from '@/lib/api/endpoints/用户组管理/用户组管理'
import { useGetUsers } from '@/lib/api/endpoints/会议管理/会议管理'
import { toast } from 'react-toastify'
import type {
  GetForManagementInstructionType,
  GetForManagementStatus,
  InstructionResponse,
  UserInfoResponse,
  UserGroupResponse,
} from '@/lib/api/endpoints/asyaBackendAPI.schemas'

const ALL_FILTER = '__ALL__'

const statusOptions: Array<GetForManagementStatus> = [
  'SUBMITTED',
  'IN_PROGRESS',
  'REJECTED',
  'FEEDBACKED',
]

const typeOptions: Array<GetForManagementInstructionType> = [
  'MILITARY',
  'DIPLOMACY',
  'INTERNAL',
  'OTHER',
]

export default function InstructionsPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { user, isLoading: authLoading, isAuthenticated, canManageConference } = useAuth()
  const canToggleSubmissionSwitch = user?.role === 'DH' || user?.role === 'SYS_ADMIN'

  const [statusFilter, setStatusFilter] = useState<GetForManagementStatus | undefined>(undefined)
  const [typeFilter, setTypeFilter] = useState<GetForManagementInstructionType | undefined>(undefined)
  const [userGroupIdFilter, setUserGroupIdFilter] = useState<number | undefined>(undefined)
  const [submitterUuidsFilter, setSubmitterUuidsFilter] = useState<string[]>([])
  const [delegateKeyword, setDelegateKeyword] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedInstructionUuid, setSelectedInstructionUuid] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data: instructionsData, isLoading, error, refetch } = useGetForManagement(
    {
      status: statusFilter,
      instructionType: typeFilter,
      userGroupId: userGroupIdFilter,
      submitterUuids: submitterUuidsFilter.length > 0 ? submitterUuidsFilter : undefined,
      pageable: {
        page: currentPage,
        size: 10,
        sort: ['submitRealTime,desc'],
      },
    },
    {
      query: {
        enabled: isAuthenticated && canManageConference,
      },
    },
  )
  const { data: groupsData } = useGetAllUserGroups({
    query: {
      enabled: isAuthenticated && canManageConference,
    },
  })
  const { data: usersData } = useGetUsers({
    query: {
      enabled: isAuthenticated && canManageConference,
    },
  })
  const { data: submissionSwitchData } = useGetSubmissionSwitch({
    query: {
      enabled: isAuthenticated && canManageConference,
      refetchInterval: 30_000,
      refetchIntervalInBackground: true,
    },
  })
  const setSubmissionSwitchMutation = useSetSubmissionSwitch()

  const groups = useMemo(() => parseApiPayload<UserGroupResponse[]>(groupsData) || [], [groupsData])
  const delegateUsers = useMemo(() => {
    const users = parseApiPayload<UserInfoResponse[]>(usersData) || []
    return users
      .filter(user => user.role === 'DELEGATE')
      .sort((a, b) => {
        const aLabel = (a.displayName?.trim() || a.name).trim()
        const bLabel = (b.displayName?.trim() || b.name).trim()
        return aLabel.localeCompare(bLabel, 'zh-CN')
      })
  }, [usersData])
  const filteredDelegateUsers = useMemo(() => {
    const keyword = delegateKeyword.trim().toLowerCase()
    if (!keyword) return delegateUsers

    return delegateUsers.filter(user => {
      const normalizedDisplayName = (user.displayName?.trim() || '').toLowerCase()
      const normalizedName = (user.name || '').toLowerCase()
      return normalizedDisplayName.includes(keyword) || normalizedName.includes(keyword)
    })
  }, [delegateKeyword, delegateUsers])
  const submitterLabelMap = useMemo(() => {
    return delegateUsers.reduce<Record<string, string>>((acc, user) => {
      const username = user.name?.trim() || ''
      const displayName = user.displayName?.trim() || ''
      acc[user.uuid] = displayName ? `${displayName} + ${username}` : username
      return acc
    }, {})
  }, [delegateUsers])
  const instructionPage = parseInstructionPage(parseApiPayload<unknown>(instructionsData))
  const submissionSwitchPaused = useMemo(
    () => parseApiPayload<boolean>(submissionSwitchData),
    [submissionSwitchData],
  )
  const isSubmissionPaused = !!submissionSwitchPaused

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !canManageConference)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, canManageConference, router])

  const groupOptions = useMemo(
    () => groups.slice().sort((a, b) => a.groupName.localeCompare(b.groupName, 'zh-CN')),
    [groups],
  )

  const handleInstructionClick = (instruction: InstructionResponse) => {
    setSelectedInstructionUuid(instruction.uuid)
    setDetailOpen(true)
  }

  const handleToggleSubmissionSwitch = async () => {
    if (!canToggleSubmissionSwitch) return

    try {
      await setSubmissionSwitchMutation.mutateAsync({
        params: { paused: !isSubmissionPaused },
      })
      toast.success(!isSubmissionPaused ? '已暂停全局指令提交' : '已恢复全局指令提交')
      await queryClient.invalidateQueries({ queryKey: getGetSubmissionSwitchQueryKey() })
    } catch (error) {
      console.error('Set submission switch failed:', error)
      toast.error('更新全局指令提交开关失败，请稍后重试')
    }
  }

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-lg text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !canManageConference) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>全局指令提交开关</CardTitle>
            <CardDescription>可查看当前暂停状态；DH / SYS_ADMIN 可切换暂停与恢复</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              <span className="text-muted-foreground">当前状态: </span>
              {isSubmissionPaused ? '已暂停提交' : '允许提交'}
            </div>
            {!canToggleSubmissionSwitch && (
              <p className="text-sm text-muted-foreground">仅 DH 与系统管理员可切换开关</p>
            )}
            <Button
              onClick={handleToggleSubmissionSwitch}
              disabled={!canToggleSubmissionSwitch || setSubmissionSwitchMutation.isPending}
              variant={isSubmissionPaused ? 'default' : 'outline'}
            >
              {setSubmissionSwitchMutation.isPending
                ? '更新中...'
                : isSubmissionPaused
                  ? '恢复提交'
                  : '暂停提交'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>指令管理</CardTitle>
            <CardDescription>分页查看当前会议的全部指令，并按状态、类型、用户组和代表筛选</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>状态</Label>
                <Select
                  value={statusFilter || ALL_FILTER}
                  onValueChange={value => {
                    setStatusFilter(value === ALL_FILTER ? undefined : (value as GetForManagementStatus))
                    setCurrentPage(0)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="全部状态" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value={ALL_FILTER}>全部状态</SelectItem>
                    {statusOptions.map(status => (
                      <SelectItem key={status} value={status}>
                        {INSTRUCTION_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>指令类型</Label>
                <Select
                  value={typeFilter || ALL_FILTER}
                  onValueChange={value => {
                    setTypeFilter(value === ALL_FILTER ? undefined : (value as GetForManagementInstructionType))
                    setCurrentPage(0)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="全部类型" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value={ALL_FILTER}>全部类型</SelectItem>
                    {typeOptions.map(type => (
                      <SelectItem key={type} value={type}>
                        {INSTRUCTION_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>用户组</Label>
                <Select
                  value={userGroupIdFilter !== undefined ? String(userGroupIdFilter) : ALL_FILTER}
                  onValueChange={value => {
                    setUserGroupIdFilter(value === ALL_FILTER ? undefined : Number(value))
                    setCurrentPage(0)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="全部用户组" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value={ALL_FILTER}>全部用户组</SelectItem>
                    {groupOptions.map(group => (
                      <SelectItem key={group.id} value={String(group.id)}>
                        {group.groupName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-3">
                <Label>代表多选</Label>
                <Input
                  value={delegateKeyword}
                  onChange={event => setDelegateKeyword(event.target.value)}
                  placeholder="输入代表 displayName / name 筛选"
                />
                <div className="max-h-32 overflow-y-auto rounded-md border p-2">
                  {filteredDelegateUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无可选代表</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredDelegateUsers.map(user => (
                        <label key={user.uuid} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={submitterUuidsFilter.includes(user.uuid)}
                            onChange={event => {
                              setSubmitterUuidsFilter(prev =>
                                event.target.checked
                                  ? [...prev, user.uuid]
                                  : prev.filter(uuid => uuid !== user.uuid),
                              )
                              setCurrentPage(0)
                            }}
                          />
                          <span>{(user.displayName?.trim() || user.name).trim()}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setStatusFilter(undefined)
                    setTypeFilter(undefined)
                    setUserGroupIdFilter(undefined)
                    setSubmitterUuidsFilter([])
                    setDelegateKeyword('')
                    setCurrentPage(0)
                  }}
                >
                  清空筛选
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>当前会议全部指令</CardTitle>
            <CardDescription>点击任意一条查看详情并进行批改</CardDescription>
          </CardHeader>
          <CardContent>
            <InstructionList
              instructions={instructionPage.content}
              isLoading={isLoading}
              error={!!error}
              emptyTitle="暂无指令"
              emptyDescription="当前筛选条件下没有符合条件的指令"
              currentPage={currentPage}
              totalPages={instructionPage.totalPages}
              isFirstPage={instructionPage.isFirstPage}
              isLastPage={instructionPage.isLastPage}
              onPreviousPage={() => setCurrentPage(page => Math.max(0, page - 1))}
              onNextPage={() => setCurrentPage(page => page + 1)}
              onInstructionClick={handleInstructionClick}
              showSubmitter
              submitterLabelMap={submitterLabelMap}
            />
          </CardContent>
        </Card>
      </div>

      <InstructionDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        instructionUuid={selectedInstructionUuid}
        canReview
        groups={groups}
        onReviewed={() => {
          refetch()
        }}
      />
    </div>
  )
}
