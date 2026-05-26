'use client'

export const TOKEN_STORAGE_EVENT = 'auth-token-change'
export const ACCESS_TOKEN_STORAGE_KEY = 'token'

function broadcastTokenChange() {
  window.dispatchEvent(new Event(TOKEN_STORAGE_EVENT))
}

export function getStoredAccessToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
}

export function hasStoredAccessToken() {
  return !!getStoredAccessToken()
}

export function setStoredAccessToken(token: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token)
  broadcastTokenChange()
}

export function clearStoredAccessToken() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
  broadcastTokenChange()
}
