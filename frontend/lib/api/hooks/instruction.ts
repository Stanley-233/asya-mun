import { useMutation, useQuery } from '@tanstack/react-query'
import {
  create2,
  getForManagement,
  getInstruction,
  getMyInstructions,
  getSubmissionSwitch,
  review,
  setSubmissionSwitch,
} from '../apis/instruction.api'
import type { NormalizedPage } from '../core/page'
import type {
  GetForManagementParams,
  GetMyInstructionsParams,
  InstructionCreateRequest,
  InstructionResponse,
  InstructionReviewRequest,
  SetSubmissionSwitchParams,
} from '../generated'
import type { MutationHookOptions, QueryHookOptions } from './shared'

export const instructionKeys = {
  submissionSwitch: () => ['/api/instructions/submission-switch'] as const,
  detail: (uuid: string) => ['/api/instructions', uuid] as const,
  my: (params?: GetMyInstructionsParams) => ['/api/instructions/my', params] as const,
  management: (params?: GetForManagementParams) => ['/api/instructions/manage', params] as const,
}

export const getGetSubmissionSwitchQueryKey = instructionKeys.submissionSwitch
export const getGetInstructionQueryKey = (uuid: string) => instructionKeys.detail(uuid)
export const getGetMyInstructionsQueryKey = (params?: GetMyInstructionsParams) => instructionKeys.my(params)
export const getGetForManagementQueryKey = (params?: GetForManagementParams) =>
  instructionKeys.management(params)

export function useGetSubmissionSwitch<TData = boolean, TError = unknown>(
  options?: QueryHookOptions<boolean, TData, TError>,
) {
  return useQuery({
    queryKey: instructionKeys.submissionSwitch(),
    queryFn: getSubmissionSwitch,
    ...options?.query,
  })
}

export function useGetInstruction<TData = InstructionResponse, TError = unknown>(
  uuid: string,
  options?: QueryHookOptions<InstructionResponse, TData, TError>,
) {
  return useQuery({
    queryKey: instructionKeys.detail(uuid),
    queryFn: () => getInstruction(uuid),
    enabled: !!uuid,
    ...options?.query,
  })
}

export function useGetMyInstructions<TData = NormalizedPage<InstructionResponse>, TError = unknown>(
  params: GetMyInstructionsParams,
  options?: QueryHookOptions<NormalizedPage<InstructionResponse>, TData, TError>,
) {
  return useQuery({
    queryKey: instructionKeys.my(params),
    queryFn: () => getMyInstructions(params),
    ...options?.query,
  })
}

export function useGetForManagement<TData = NormalizedPage<InstructionResponse>, TError = unknown>(
  params: GetForManagementParams,
  options?: QueryHookOptions<NormalizedPage<InstructionResponse>, TData, TError>,
) {
  return useQuery({
    queryKey: instructionKeys.management(params),
    queryFn: () => getForManagement(params),
    ...options?.query,
  })
}

export function useCreate2<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { data: InstructionCreateRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ data }) => create2(data),
    ...options?.mutation,
  })
}

export function useReview<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { uuid: string; data: InstructionReviewRequest }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ uuid, data }) => review(uuid, data),
    ...options?.mutation,
  })
}

export function useSetSubmissionSwitch<TError = unknown, TContext = unknown>(
  options?: MutationHookOptions<void, { params: SetSubmissionSwitchParams }, TError, TContext>,
) {
  return useMutation({
    mutationFn: ({ params }) => setSubmissionSwitch(params),
    ...options?.mutation,
  })
}
