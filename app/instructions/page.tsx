'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
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
import { useGetForManagement } from '@/lib/api/endpoints/指令管理/指令管理'
import { useGetAllUserGroups } from '@/lib/api/endpoints/用户组管理/用户组管理'
import { useGetUsers } from '@/lib/api/endpoints/会议管理/会议管理'
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
  const router = useRouter()
  const { isLoading: authLoading, isAuthenticated, canManageConference } = useAuth()

  const [statusFilter, setStatusFilter] = useState<GetForManagementStatus | undefined>(undefined)
  const [typeFilter, setTypeFilter] = useState<GetForManagementInstructionType | undefined>(undefined)
  const [userGroupIdFilter, setUserGroupIdFilter] = useState<number | undefined>(undefined)
  const [submitterUuidsFilter, setSubmitterUuidsFilter] = useState<string[]>([])
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
  const instructionPage = parseInstructionPage(parseApiPayload<unknown>(instructionsData))

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
                <div className="max-h-32 overflow-y-auto rounded-md border p-2">
                  {delegateUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无可选代表</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {delegateUsers.map(user => (
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
