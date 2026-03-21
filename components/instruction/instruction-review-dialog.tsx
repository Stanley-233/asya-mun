'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useReview } from '@/lib/api/endpoints/指令管理/指令管理'
import type {
  InstructionResponse,
  InstructionReviewRequestStatus,
} from '@/lib/api/endpoints/asyaBackendAPI.schemas'
import { toast } from 'react-toastify'
import { INSTRUCTION_STATUS_LABELS } from './instruction-utils'

const reviewStatusOptions: InstructionReviewRequestStatus[] = [
  'IN_PROGRESS',
  'REJECTED',
  'FEEDBACKED',
]

interface InstructionReviewDialogProps {
  instruction: InstructionResponse | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function InstructionReviewDialog({
  instruction,
  open,
  onOpenChange,
  onSuccess,
}: InstructionReviewDialogProps) {
  const defaultStatus: InstructionReviewRequestStatus =
    instruction && instruction.status !== 'SUBMITTED' ? instruction.status : 'IN_PROGRESS'
  const { mutate: reviewInstruction, isPending } = useReview()
  const [status, setStatus] = useState<InstructionReviewRequestStatus>(defaultStatus)
  const [reviewComment, setReviewComment] = useState(instruction?.reviewComment || '')

  const handleSubmit = () => {
    if (!instruction) return

    reviewInstruction(
      {
        uuid: instruction.uuid,
        data: {
          status,
          reviewComment: reviewComment.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('批改成功')
          onSuccess?.()
          onOpenChange(false)
        },
        onError: error => {
          console.error('Failed to review instruction:', error)
          toast.error('批改失败，请稍后重试')
        },
      },
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader className="items-start text-left">
          <AlertDialogTitle>批改指令</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instruction-review-status">状态</Label>
            <Select value={status} onValueChange={value => setStatus(value as InstructionReviewRequestStatus)}>
              <SelectTrigger id="instruction-review-status" className="w-full">
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent align="start">
                {reviewStatusOptions.map(option => (
                  <SelectItem key={option} value={option}>
                    {INSTRUCTION_STATUS_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instruction-review-comment">评语</Label>
            <Textarea
              id="instruction-review-comment"
              value={reviewComment}
              onChange={event => setReviewComment(event.target.value)}
              placeholder="请输入评语"
              rows={6}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>取消</AlertDialogCancel>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? '提交中...' : '提交批改'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
