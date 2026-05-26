'use client'

import type { DelegateNotificationEvent } from './types'

const STORAGE_PREFIX = 'asya-delegate-notification-resolution:v2'

interface NotificationStorageScope {
  userUuid: string
  conferenceUuid: string
}

type NotificationResolutionState = Record<string, boolean>

function getStorageKey(scope: NotificationStorageScope) {
  return `${STORAGE_PREFIX}:${scope.userUuid}:${scope.conferenceUuid}`
}

function safeParse(value: string | null): NotificationResolutionState {
  if (!value) return {}

  try {
    const parsed = JSON.parse(value) as NotificationResolutionState
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

export function getNotificationStorageId(event: Pick<DelegateNotificationEvent, 'kind' | 'messageUuid' | 'instructionUuid' | 'eventId'>) {
  if ((event.kind === 'PUBLIC_MESSAGE' || event.kind === 'SECRET_MESSAGE') && event.messageUuid) {
    return `${event.kind}:${event.messageUuid}`
  }

  if (event.kind === 'INSTRUCTION_FEEDBACK' && event.instructionUuid) {
    return `${event.kind}:${event.instructionUuid}`
  }

  return event.eventId
}

export function loadNotificationResolutionState(
  scope: NotificationStorageScope,
): NotificationResolutionState {
  if (typeof window === 'undefined') return {}
  return safeParse(window.localStorage.getItem(getStorageKey(scope)))
}

export function saveNotificationResolutionState(
  scope: NotificationStorageScope,
  resolutionState: NotificationResolutionState,
) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(getStorageKey(scope), JSON.stringify(resolutionState))
}

export function ensureNotificationPending(
  scope: NotificationStorageScope,
  event: DelegateNotificationEvent,
) {
  const current = loadNotificationResolutionState(scope)
  const storageId = getNotificationStorageId(event)
  if (storageId in current) {
    return current
  }
  const next = {
    ...current,
    [storageId]: false,
  }
  saveNotificationResolutionState(scope, next)
  return next
}

export function markNotificationResolved(
  scope: NotificationStorageScope,
  event: DelegateNotificationEvent,
) {
  const current = loadNotificationResolutionState(scope)
  const next = {
    ...current,
    [getNotificationStorageId(event)]: true,
  }
  saveNotificationResolutionState(scope, next)
  return next
}

export function isNotificationResolved(
  scope: NotificationStorageScope,
  event: DelegateNotificationEvent,
) {
  const current = loadNotificationResolutionState(scope)
  return current[getNotificationStorageId(event)] === true
}
