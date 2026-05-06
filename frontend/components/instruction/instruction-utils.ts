'use client'

import { normalizePagePayload } from '@/lib/api/core/page'
import type {
  GetForManagementInstructionType,
  GetForManagementStatus,
  InstructionCreateRequestInstructionType,
  InstructionResponse,
  InstructionResponseInstructionType,
  InstructionResponseStatus,
  InstructionReviewRequestStatus,
  UserGroupResponse,
} from '@/lib/api/generated'

export const INSTRUCTION_TYPE_LABELS: Record<
  | InstructionCreateRequestInstructionType
  | InstructionResponseInstructionType
  | GetForManagementInstructionType,
  string
> = {
  MILITARY: '军事',
  DIPLOMACY: '外交',
  INTERNAL: '内政',
  OTHER: '其他',
}

export const INSTRUCTION_STATUS_LABELS: Record<
  | InstructionResponseStatus
  | InstructionReviewRequestStatus
  | GetForManagementStatus,
  string
> = {
  SUBMITTED: '已提交',
  IN_PROGRESS: '处理中',
  REJECTED: '已驳回',
  FEEDBACKED: '已反馈',
}

export const INSTRUCTION_STATUS_VARIANTS: Record<
  InstructionResponseStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  SUBMITTED: 'secondary',
  IN_PROGRESS: 'default',
  REJECTED: 'destructive',
  FEEDBACKED: 'outline',
}

export const INSTRUCTION_STATUS_CLASSNAMES: Partial<Record<InstructionResponseStatus, string>> = {
  FEEDBACKED: 'border-orange-500 bg-orange-500 text-white',
}

export function formatInstructionRealTime(value?: string) {
  if (!value) return '未知'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN')
}

export function formatInstructionGameTime(value?: string) {
  if (!value) return '未知'

  try {
    const match = value.match(/^(-?\d+)-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/)
    if (!match) return value

    const [, yearStr, month, day, hour, minute] = match
    const year = Number.parseInt(yearStr, 10)
    const isBc = year <= 0
    const displayYear = isBc ? 1 - year : year

    return `${isBc ? 'BC ' : ''}${displayYear}年${month}月${day}日 ${hour}:${minute}`
  } catch {
    return value
  }
}

export function summarizeInstructionReviewComment(instruction: InstructionResponse) {
  const comment = instruction.reviewComment?.trim()
  if (!comment) return '暂无评语'
  return comment.length > 36 ? `${comment.slice(0, 36)}...` : comment
}

export function getInstructionSubmitterGroupNames(
  instruction: InstructionResponse,
  groups: UserGroupResponse[],
) {
  return groups
    .filter(group => group.userUuids.includes(instruction.submitterId))
    .map(group => group.groupName)
}

export function parseInstructionPage(raw: unknown) {
  return normalizePagePayload<InstructionResponse>(raw)
}
