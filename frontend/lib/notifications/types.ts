'use client'

export type DelegateNotificationKind =
  | 'PUBLIC_MESSAGE'
  | 'SECRET_MESSAGE'
  | 'INSTRUCTION_FEEDBACK'

export interface DelegateNotificationEvent {
  eventId: string
  kind: DelegateNotificationKind
  occurredAt: string
  messageUuid?: string
  instructionUuid?: string
  title: string
  brief: string
  senderName?: string
}
