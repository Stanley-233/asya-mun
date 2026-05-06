'use client'

import { useMemo, useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { parseApiPayload } from '@/lib/api/response-utils'
import { useGetInstruction } from '@/lib/api/hooks/instruction'
import type { InstructionResponse, UserGroupResponse } from '@/lib/api/generated'
import {
  formatInstructionGameTime,
  formatInstructionRealTime,
  getInstructionSubmitterGroupNames,
  INSTRUCTION_STATUS_CLASSNAMES,
  INSTRUCTION_STATUS_LABELS,
  INSTRUCTION_STATUS_VARIANTS,
  INSTRUCTION_TYPE_LABELS,
} from './instruction-utils'
import { InstructionReviewDialog } from './instruction-review-dialog'

interface InstructionDetailDialogProps {
  instructionUuid: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canReview: boolean
  onReviewed?: () => void
  groups?: UserGroupResponse[]
}

export function InstructionDetailDialog({
  instructionUuid,
  open,
  onOpenChange,
  canReview,
  onReviewed,
  groups = [],
}: InstructionDetailDialogProps) {
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const { data, isLoading, error, refetch } = useGetInstruction(instructionUuid || '', {
    query: {
      enabled: !!instructionUuid && open,
    },
  })

  const instruction = parseApiPayload<InstructionResponse>(data)

  const submitterGroups = useMemo(() => {
    if (!instruction) return []
    return getInstructionSubmitterGroupNames(instruction, groups)
  }, [instruction, groups])

  const handleReviewed = () => {
    refetch()
    onReviewed?.()
  }

  return (
    <>
      <AlertDialog
        open={open}
        onOpenChange={nextOpen => {
          if (!nextOpen) {
            setReviewDialogOpen(false)
          }
          onOpenChange(nextOpen)
        }}
      >
        <AlertDialogContent className="!max-w-4xl max-h-[90vh] flex flex-col">
          <AlertDialogHeader className="items-start text-left">
            <div className="flex w-full flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {instruction && (
                    <>
                      <Badge variant="secondary">
                        {INSTRUCTION_TYPE_LABELS[instruction.instructionType]}
                      </Badge>
                      <Badge
                        variant={INSTRUCTION_STATUS_VARIANTS[instruction.status]}
                        className={INSTRUCTION_STATUS_CLASSNAMES[instruction.status]}
                      >
                        {INSTRUCTION_STATUS_LABELS[instruction.status]}
                      </Badge>
                    </>
                  )}
                </div>
                <AlertDialogTitle className="text-2xl">
                  {instruction?.title || '指令详情'}
                </AlertDialogTitle>
              </div>
              {canReview && instruction && (
                <Button onClick={() => setReviewDialogOpen(true)}>
                  批改
                </Button>
              )}
            </div>
          </AlertDialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {isLoading && (
              <div className="flex items-center justify-center p-10 text-muted-foreground">
                加载中...
              </div>
            )}
            {!isLoading && !error && instruction && (
              <div className="space-y-6">
                <div className="grid gap-4 rounded-lg bg-muted/40 p-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">提交人</p>
                    <p className="mt-1 text-sm font-medium">{instruction.submitterName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">所属用户组</p>
                    <p className="mt-1 text-sm">
                      {submitterGroups.length > 0 ? submitterGroups.join('、') : '未分组'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">提交现实时间</p>
                    <p className="mt-1 text-sm">{formatInstructionRealTime(instruction.submitRealTime)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">提交会议次元时间</p>
                    <p className="mt-1 text-sm">{formatInstructionGameTime(instruction.submitGameTime)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">最后批改人</p>
                    <p className="mt-1 text-sm">{instruction.reviewedByName || '暂无'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">最后批改时间</p>
                    <p className="mt-1 text-sm">
                      {instruction.reviewedRealTime
                        ? formatInstructionRealTime(instruction.reviewedRealTime)
                        : '暂无'}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-semibold">指令内容</p>
                  <div className="mt-3 whitespace-pre-wrap rounded-lg border bg-background p-4 text-sm leading-6">
                    {instruction.content}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold">最终评语</p>
                  <div className="mt-3 whitespace-pre-wrap rounded-lg border bg-background p-4 text-sm leading-6">
                    {instruction.reviewComment?.trim() || '暂无评语'}
                  </div>
                </div>
              </div>
            )}
          </div>

          <AlertDialogFooter className="flex-shrink-0">
            <AlertDialogCancel>关闭</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InstructionReviewDialog
        key={`${instruction?.uuid || 'empty'}-${instruction?.reviewedRealTime || 'none'}-${reviewDialogOpen ? 'open' : 'closed'}`}
        instruction={instruction || null}
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        onSuccess={handleReviewed}
      />
    </>
  )
}
