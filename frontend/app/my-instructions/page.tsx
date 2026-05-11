'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/contexts/auth-context'
import { useGetMine } from '@/lib/api/hooks/conference'
import { InstructionDetailDialog, InstructionList, InstructionSubmitForm } from '@/components/instruction'
import { createEmptyPage } from '@/lib/api/core/page'
import { buildLoginRedirect } from '@/lib/auth/return-to'
import { useGetMyInstructions, useGetSubmissionSwitch } from '@/lib/api/hooks/instruction'
import { INSTRUCTION_STATUS_LABELS } from '@/components/instruction/instruction-utils'
import type { GetMyInstructionsStatus, InstructionResponse } from '@/lib/api/generated'

const ALL_INSTRUCTION_STATUS = '__ALL__'
const PAGE_SIZE_OPTIONS = ['5', '10', '15', '20']

const myInstructionStatusOptions: GetMyInstructionsStatus[] = [
  'SUBMITTED',
  'IN_PROGRESS',
  'REJECTED',
  'FEEDBACKED',
]

export default function MyInstructionsPage() {
  const router = useRouter()
  const { user, isLoading, isAuthenticated } = useAuth()
  const { data: conferenceData } = useGetMine()
  const canReviewInstructions = user?.role === 'DM' || user?.role === 'DH' || user?.role === 'SYS_ADMIN'
  const canSubmitInstruction = user?.role === 'DELEGATE'

  const [selectedInstructionUuid, setSelectedInstructionUuid] = useState<string | null>(null)
  const [instructionDetailOpen, setInstructionDetailOpen] = useState(false)
  const [instructionCurrentPage, setInstructionCurrentPage] = useState(0)
  const [instructionPageSize, setInstructionPageSize] = useState(10)
  const [instructionStatusFilter, setInstructionStatusFilter] = useState<GetMyInstructionsStatus | undefined>(undefined)

  const { data: myInstructionsData, isLoading: myInstructionsLoading, error: myInstructionsError, refetch: refetchMyInstructions } =
    useGetMyInstructions(
      {
        status: instructionStatusFilter,
        pageable: {
          page: instructionCurrentPage,
          size: instructionPageSize,
          sort: ['submitRealTime,desc'],
        },
      },
      { query: { enabled: isAuthenticated } },
    )

  const { data: submissionSwitchData } = useGetSubmissionSwitch({
    query: {
      enabled: isAuthenticated && canSubmitInstruction,
      refetchInterval: 30_000,
      refetchIntervalInBackground: true,
    },
  })

  const instructionPage = myInstructionsData ?? createEmptyPage<InstructionResponse>()
  const conference = useMemo(() => conferenceData ?? null, [conferenceData])
  const instructionSubmissionPaused = useMemo(() => submissionSwitchData ?? null, [submissionSwitchData])
  const isInstructionSubmissionPaused = !!instructionSubmissionPaused
  const instructionSubmitDisabledReason = !conference
    ? '尚未关联会议，暂时无法提交指令，请联系管理员。'
    : isInstructionSubmissionPaused
      ? '当前会议已暂停指令提交，请等待主席团恢复。'
      : undefined

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(buildLoginRedirect())
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (!isLoading && isAuthenticated && !canSubmitInstruction) {
      router.push('/progress')
    }
  }, [isLoading, isAuthenticated, canSubmitInstruction, router])

  const handleInstructionClick = (instruction: InstructionResponse) => {
    setSelectedInstructionUuid(instruction.uuid)
    setInstructionDetailOpen(true)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-lg text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!user || !canSubmitInstruction) return null

  return (
    <div className="container mx-auto px-4 py-8">
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
                  onValueChange={(value) => {
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
                    {myInstructionStatusOptions.map((status) => (
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
              pageSize={instructionPageSize}
              totalPages={instructionPage.totalPages}
              totalElements={instructionPage.totalElements}
              isFirstPage={instructionPage.isFirstPage}
              isLastPage={instructionPage.isLastPage}
              onPreviousPage={() => setInstructionCurrentPage((page) => Math.max(0, page - 1))}
              onNextPage={() => setInstructionCurrentPage((page) => page + 1)}
              onPageSizeChange={(value) => {
                setInstructionPageSize(value)
                setInstructionCurrentPage(0)
              }}
              onInstructionClick={handleInstructionClick}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          </CardContent>
        </Card>

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
      </div>

      <InstructionDetailDialog
        open={instructionDetailOpen}
        onOpenChange={setInstructionDetailOpen}
        instructionUuid={selectedInstructionUuid}
        canReview={canReviewInstructions}
        onReviewed={() => refetchMyInstructions()}
      />
    </div>
  )
}
