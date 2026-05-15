'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { InstructionResponse } from '@/lib/api/generated'
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import {
  INSTRUCTION_STATUS_CLASSNAMES,
  formatInstructionRealTime,
  formatInstructionGameTime,
  INSTRUCTION_STATUS_LABELS,
  INSTRUCTION_STATUS_VARIANTS,
  INSTRUCTION_TYPE_LABELS,
  summarizeInstructionReviewComment,
} from './instruction-utils'

interface InstructionListProps {
  instructions: InstructionResponse[]
  isLoading?: boolean
  error?: boolean
  emptyTitle?: string
  emptyDescription?: string
  currentPage: number
  pageSize: number
  totalPages: number
  totalElements: number
  isFirstPage: boolean
  isLastPage: boolean
  onPreviousPage: () => void
  onNextPage: () => void
  onPageSizeChange: (pageSize: number) => void
  onInstructionClick: (instruction: InstructionResponse) => void
  showSubmitter?: boolean
  submitterLabelMap?: Record<string, string>
  pageSizeOptions?: string[]
}

export function InstructionList({
  instructions,
  isLoading,
  error,
  emptyTitle = '暂无指令',
  emptyDescription = '当前没有可展示的指令',
  currentPage,
  pageSize,
  totalPages,
  totalElements,
  isFirstPage,
  isLastPage,
  onPreviousPage,
  onNextPage,
  onPageSizeChange,
  onInstructionClick,
  showSubmitter = false,
  submitterLabelMap,
  pageSizeOptions = ['5', '10', '15', '20'],
}: InstructionListProps) {
  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        加载指令失败，请稍后重试
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {isLoading && (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          加载中...
        </div>
      )}

      {!isLoading && instructions.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          <FileText className="mb-3 h-8 w-8" />
          <p className="text-lg">{emptyTitle}</p>
          <p className="mt-2 text-sm">{emptyDescription}</p>
        </div>
      )}

      {!isLoading && instructions.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {instructions.map(instruction => (
              <button
                key={instruction.uuid}
                type="button"
                onClick={() => onInstructionClick(instruction)}
                className="rounded-xl border p-4 text-left transition-colors hover:border-primary/60 hover:bg-muted/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {INSTRUCTION_TYPE_LABELS[instruction.instructionType]}
                      </Badge>
                      <Badge
                        variant={INSTRUCTION_STATUS_VARIANTS[instruction.status]}
                        className={INSTRUCTION_STATUS_CLASSNAMES[instruction.status]}
                      >
                        {INSTRUCTION_STATUS_LABELS[instruction.status]}
                      </Badge>
                    </div>
                    <div>
                      <p className="font-medium">{instruction.title}</p>
                      {showSubmitter && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          提交人：
                          {submitterLabelMap?.[instruction.submitterId] || instruction.submitterName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
                    <span>会议: {formatInstructionGameTime(instruction.submitGameTime)}</span>
                    <span>现实: {formatInstructionRealTime(instruction.submitRealTime)}</span>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {instruction.content}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  最终反馈：{summarizeInstructionReviewComment(instruction)}
                </p>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="text-sm text-muted-foreground">
                第 {currentPage + 1} 页，共 {Math.max(totalPages, 1)} 页，共 {totalElements} 条
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="instruction-page-size" className="text-sm text-muted-foreground">
                  每页
                </Label>
                <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
                  <SelectTrigger id="instruction-page-size" className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pageSizeOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option} 条
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onPreviousPage} disabled={isFirstPage}>
                <ChevronLeft />
                上一页
              </Button>
              <Button variant="outline" size="sm" onClick={onNextPage} disabled={isLastPage}>
                下一页
                <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
