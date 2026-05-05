'use client'

import React, { createContext, useContext, useMemo, useState } from 'react'
import { useGetCurrentUser } from '@/lib/api/endpoints/用户管理/用户管理'
import { parseApiPayload } from '@/lib/api/response-utils'
import type { UserInfoResponse } from '@/lib/api/endpoints/asyaBackendAPI.schemas'

export interface AuthContextType {
  user: UserInfoResponse | null
  isLoading: boolean
  isAuthenticated: boolean
  isSysAdmin: boolean
  canManageConference: boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [hasToken, setHasToken] = useState(() => (
    typeof window !== 'undefined' ? !!localStorage.getItem('token') : false
  ))
  
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
    return parseApiPayload<UserInfoResponse>(currentUserData)
  }, [currentUserData, error, hasToken])

  const logout = () => {
    setHasToken(false)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
  }

  const value: AuthContextType = {
    user,
    isLoading: hasToken && queryLoading,
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
