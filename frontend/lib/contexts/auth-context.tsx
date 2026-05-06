'use client'

import React, { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import { useGetCurrentUser } from '@/lib/api/hooks/user'
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

const TOKEN_STORAGE_EVENT = 'auth-token-change'

function subscribeToTokenChange(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener(TOKEN_STORAGE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(TOKEN_STORAGE_EVENT, onStoreChange)
  }
}

function getTokenSnapshot() {
  return !!localStorage.getItem('token')
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      window.dispatchEvent(new Event(TOKEN_STORAGE_EVENT))
      window.location.href = '/'
    }
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
