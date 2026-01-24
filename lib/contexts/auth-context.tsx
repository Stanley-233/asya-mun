'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useGetCurrentUser } from '@/lib/api/endpoints/用户管理/用户管理'
import type { UserInfoResponse } from '@/lib/api/endpoints/asyaBackendAPI.schemas'

export interface AuthContextType {
  user: UserInfoResponse | null
  isLoading: boolean
  isAuthenticated: boolean
  isSysAdmin: boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfoResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [hasToken, setHasToken] = useState(false)

  useEffect(() => {
    setMounted(true)
    // 检查是否有 token
    if (typeof window !== 'undefined') {
      setHasToken(!!localStorage.getItem('token'))
    }
  }, [])
  
  // 只在有 token 时才调用 API
  const { data: currentUserData, isLoading: queryLoading, error } = useGetCurrentUser({
    query: {
      enabled: hasToken && mounted, // 只在有 token 且已挂载时才请求
    }
  })

  useEffect(() => {
    if (!mounted || !hasToken) {
      setIsLoading(false)
      return
    }

    setIsLoading(queryLoading)
    
    if (currentUserData && !error) {
      try {
        const responseData = (currentUserData as any).data
        if (responseData) {
          const parsedData = typeof responseData === 'string' 
            ? JSON.parse(responseData) 
            : responseData
          
          // 提取用户信息
          const userData = parsedData.data || parsedData
          setUser(userData)
        }
      } catch (err) {
        console.error('Failed to parse user data:', err)
        setUser(null)
      }
    } else if (error) {
      setUser(null)
      setIsLoading(false)
    }
  }, [currentUserData, queryLoading, error, mounted, hasToken])

  const logout = () => {
    setUser(null)
    setHasToken(false)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isSysAdmin: user?.role === 'SYS_ADMIN',
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
