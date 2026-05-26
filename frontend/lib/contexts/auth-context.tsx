'use client'

import React, { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import { clearClientAuth } from '@/lib/api/client'
import { logoutSession, useGetCurrentUser } from '@/lib/api/hooks/user'
import {
  hasStoredAccessToken,
  TOKEN_STORAGE_EVENT,
} from '@/lib/auth/token-storage'
import type { UserInfoResponse } from '@/lib/api/generated'

export interface AuthContextType {
  user: UserInfoResponse | null
  isLoading: boolean
  isAuthenticated: boolean
  isSysAdmin: boolean
  canManageConference: boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function subscribeToTokenChange(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener(TOKEN_STORAGE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(TOKEN_STORAGE_EVENT, onStoreChange)
  }
}

function getTokenSnapshot() {
  return hasStoredAccessToken()
}

function getServerTokenSnapshot() {
  return false
}

function subscribeToHydration() {
  return () => {}
}

function getClientHydrationSnapshot() {
  return true
}

function getServerHydrationSnapshot() {
  return false
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  )
  const hasToken = useSyncExternalStore(
    subscribeToTokenChange,
    getTokenSnapshot,
    getServerTokenSnapshot,
  )
  
  // 只在有 token 时才调用 API
  const { data: currentUserData, isLoading: queryLoading, error } = useGetCurrentUser({
    query: {
      enabled: hasToken, // 只在有 token 时才请求
      retry: false,
      refetchOnWindowFocus: false,
    }
  })

  const user = useMemo(() => {
    if (!hasToken || error || !currentUserData) return null
    return currentUserData
  }, [currentUserData, error, hasToken])

  const logout = () => {
    void logoutSession().catch(() => undefined).finally(() => {
      clearClientAuth({ redirect: true })
    })
  }

  const value: AuthContextType = {
    user,
    isLoading: !isHydrated || (hasToken && (queryLoading || (!currentUserData && !error))),
    isAuthenticated: !!user,
    isSysAdmin: user?.role === 'SYS_ADMIN',
    canManageConference: user?.role === 'DM' || user?.role === 'DH' || user?.role === 'SYS_ADMIN',
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
