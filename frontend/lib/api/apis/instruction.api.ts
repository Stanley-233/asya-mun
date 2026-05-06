import { apiRequester } from '../client'
import { normalizePagePayload, type NormalizedPage } from '../core/page'
import { withQuery } from '../core/query'
import type {
  GetForManagementParams,
  GetMyInstructionsParams,
  InstructionCreateRequest,
  InstructionResponse,
  InstructionReviewRequest,
  SetSubmissionSwitchParams,
} from '../generated'

export async function create2(data: InstructionCreateRequest) {
  return apiRequester.requestProtected<void>({
    path: '/api/instructions',
    method: 'POST',
    body: data,
  })
}

export async function review(uuid: string, data: InstructionReviewRequest) {
  return apiRequester.requestProtected<void>({
    path: `/api/instructions/${uuid}/review`,
    method: 'POST',
    body: data,
  })
}

export async function getSubmissionSwitch() {
  return apiRequester.requestProtected<boolean>({
    path: '/api/instructions/submission-switch',
    method: 'GET',
  })
}

export async function setSubmissionSwitch(params: SetSubmissionSwitchParams) {
  return apiRequester.requestProtected<void>({
    path: withQuery('/api/instructions/submission-switch', params as Record<string, unknown>),
    method: 'POST',
  })
}

export async function getInstruction(uuid: string) {
  return apiRequester.requestProtected<InstructionResponse>({
    path: `/api/instructions/${uuid}`,
    method: 'GET',
  })
}

export async function getMyInstructions(params: GetMyInstructionsParams) {
  const response = await apiRequester.requestProtected<unknown>({
    path: withQuery('/api/instructions/my', params as Record<string, unknown>),
    method: 'GET',
  })
  return normalizePagePayload<InstructionResponse>(response)
}

export async function getForManagement(params: GetForManagementParams) {
  const response = await apiRequester.requestProtected<unknown>({
    path: withQuery('/api/instructions/manage', params as Record<string, unknown>),
    method: 'GET',
  })
  return normalizePagePayload<InstructionResponse>(response)
}

export type { NormalizedPage }
