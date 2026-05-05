'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login, register, useGetRegistrationSwitch } from "@/lib/api/endpoints/用户管理/用户管理"
import { UserRegistrationRequestRole } from "@/lib/api/endpoints/asyaBackendAPI.schemas"
import { parseApiPayload } from '@/lib/api/response-utils'
import { TermsDialog } from "@/components/terms-dialog"
import { toast } from 'react-toastify'
import { getSafeReturnTo, RETURN_TO_STORAGE_KEY } from '@/lib/auth/return-to'

interface ApiError {
  message?: string
  response?: {
    data?: {
      message?: string
    }
  }
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const apiError = error as ApiError
  return apiError.message || apiError.response?.data?.message || fallback
}

const LICENSE_ACKNOWLEDGED_KEY = 'asya-license-acknowledged'

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [allowRegister, setAllowRegister] = useState(true)
  const [termsOpen, setTermsOpen] = useState(false)
  const [pendingRedirect, setPendingRedirect] = useState(false)

  const { data: registrationSwitchData } = useGetRegistrationSwitch({
    query: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  })

  // 登录表单状态
  const [loginForm, setLoginForm] = useState({
    name: '',
    password: '',
  })

  // 注册表单状态
  const [registerForm, setRegisterForm] = useState({
    name: '',
    displayName: '',
    password: '',
    confirmPassword: '',
    role: 'DM' as UserRegistrationRequestRole,
  })

  useEffect(() => {
    if (!registrationSwitchData) return
    const allowed = parseApiPayload<boolean>(registrationSwitchData)
    if (typeof allowed === 'boolean') {
      setAllowRegister(allowed)
      if (!allowed && tab === 'register') {
        setTab('login')
      }
    }
  }, [registrationSwitchData, tab])

  const finishLogin = () => {
    const searchParams = new URLSearchParams(window.location.search)
    const queryReturnTo = getSafeReturnTo(searchParams.get('returnTo'))
    const storedReturnTo = getSafeReturnTo(sessionStorage.getItem(RETURN_TO_STORAGE_KEY))
    const nextPath = queryReturnTo || storedReturnTo || '/'

    sessionStorage.removeItem(RETURN_TO_STORAGE_KEY)
    window.location.href = nextPath
  }

  const handleAuthSuccess = (message: string) => {
    const hasAcknowledged = localStorage.getItem(LICENSE_ACKNOWLEDGED_KEY) === 'true'

    if (hasAcknowledged) {
      toast.success(message, {
        closeOnClick: false,
        draggable: false,
        onClose: finishLogin,
      })
      return
    }

    toast.success('登录成功，请先确认 AGPL 授权与使用说明后进入系统', {
      closeOnClick: false,
      draggable: false,
    })
    setPendingRedirect(true)
    setTermsOpen(true)
  }

  const handleTermsOpenChange = (nextOpen: boolean) => {
    if (!pendingRedirect && !nextOpen) {
      setTermsOpen(false)
      return
    }

    if (!nextOpen && pendingRedirect) {
      localStorage.setItem(LICENSE_ACKNOWLEDGED_KEY, 'true')
      setPendingRedirect(false)
      setTermsOpen(false)
      finishLogin()
      return
    }

    setTermsOpen(nextOpen)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!loginForm.name || !loginForm.password) {
      toast.warning('请填写所有字段')
      return
    }

    setLoading(true)
    try {
      const response = await login({
        name: loginForm.name,
        password: loginForm.password,
        role: 'DM' as UserRegistrationRequestRole,
      })
      
      // 调试：打印响应数据
      console.log('登录响应:', response)
      
      const responseData = parseApiPayload<{ token?: string }>(response)
      console.log('响应数据:', responseData)
      
      const token = responseData?.token
      if (token) {
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(responseData))
        handleAuthSuccess('登录成功，正在跳转到主页...')
      } else {
        console.warn('未找到 token，响应数据:', responseData)
        toast.error('登录成功但未获取到 Token')
      }
    } catch (err: unknown) {
      // 调试：打印错误信息
      console.warn('登录错误:', err)
      
      // 优先使用错误对象的 message，然后是响应中的 message
      toast.error(getApiErrorMessage(err, '登录失败，请检查用户昵称和密码'))
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!registerForm.name || !registerForm.password || !registerForm.confirmPassword) {
      toast.warning('请填写所有字段')
      return
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      toast.warning('两次输入的密码不一致')
      return
    }

    if (registerForm.password.length < 6) {
      toast.warning('密码长度不少于 6 个字符')
      return
    }

    setLoading(true)
    try {
      // 先注册
      await register({
        name: registerForm.name,
        displayName: registerForm.displayName?.trim() || undefined,
        password: registerForm.password,
        role: registerForm.role,
      })
      
      // 注册成功后自动登录
      const loginResponse = await login({
        name: registerForm.name,
        password: registerForm.password,
        role: registerForm.role,
      })
      
      const loginData = parseApiPayload<{ token?: string }>(loginResponse)
      const token = loginData?.token
      
      if (token) {
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(loginData))
        setRegisterForm({ name: '', displayName: '', password: '', confirmPassword: '', role: 'DM' })
        handleAuthSuccess('注册成功，正在跳转到主页...')
      } else {
        toast.warning('注册成功，但自动登录失败，请手动登录')
        setTab('login')
      }
    } catch (err: unknown) {
      // 优先使用错误对象的 message，然后是响应中的 message
      toast.error(getApiErrorMessage(err, '注册失败，请重试'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-16 min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">ASYA 系统</CardTitle>
            <CardDescription className="mt-2">
              {tab === 'login' ? '登录您的账户' : '创建新账户'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* 选项卡按钮 */}
            <div className={`grid gap-2 mb-6 ${allowRegister ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <button
                type="button"
                onClick={() => {
                  setTab('login')
                }}
                className={`py-2 px-4 rounded-md font-medium transition-colors ${
                  tab === 'login'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                登录
              </button>
              {allowRegister && (
                <button
                  type="button"
                  onClick={() => {
                    setTab('register')
                  }}
                  className={`py-2 px-4 rounded-md font-medium transition-colors ${
                    tab === 'register'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  注册
                </button>
              )}
            </div>
            {/* 登录表单 */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-name">用户昵称</Label>
                  <Input
                    id="login-name"
                    placeholder="请输入用户昵称"
                    value={loginForm.name}
                    onChange={(e) => setLoginForm({ ...loginForm, name: e.target.value })}
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">密码</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="请输入密码"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '登录中...' : '登录'}
                </Button>
              </form>
            )}

            {/* 注册表单 */}
            {tab === 'register' && allowRegister && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">用户昵称</Label>
                  <Input
                    id="register-name"
                    placeholder="请输入用户昵称"
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-display-name">显示名称（可选）</Label>
                  <Input
                    id="register-display-name"
                    placeholder="请输入显示名称"
                    value={registerForm.displayName}
                    onChange={(e) => setRegisterForm({ ...registerForm, displayName: e.target.value })}
                    disabled={loading}
                    autoComplete="nickname"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password">密码</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="请输入密码（至少6个字符）"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">确认密码</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="请再次输入密码"
                    value={registerForm.confirmPassword}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, confirmPassword: e.target.value })
                    }
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">用户角色</Label>
                  <select
                    id="role"
                    value={registerForm.role}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, role: e.target.value as UserRegistrationRequestRole })
                    }
                    disabled={loading}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="DM">DM</option>
                    <option value="DH">DH</option>
                    <option value="DELEGATE">DELEGATE</option>
                    <option value="SYS_ADMIN">SYS_ADMIN</option>
                  </select>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '注册中...' : '注册'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* 页脚文本 */}
        <div className="text-center mt-4 text-sm text-muted-foreground">
          {tab === 'login' ? (
            <p>
              还没有账户？{' '}
              <button
                type="button"
                onClick={() => {
                  setTab('register')
                }}
                className="text-primary hover:underline font-medium"
              >
                立即注册
              </button>
            </p>
          ) : (
            <p>
              已有账户？{' '}
              <button
                type="button"
                onClick={() => {
                  setTab('login')
                }}
                className="text-primary hover:underline font-medium"
              >
                返回登录
              </button>
            </p>
          )}
        </div>

        {/* 使用条款 */}
        <div className="flex justify-center mt-4">
          <TermsDialog variant="link" />
        </div>

        <TermsDialog
          open={termsOpen}
          onOpenChange={handleTermsOpenChange}
          showTrigger={false}
          confirmLabel="确认并进入系统"
        />
      </div>
    </div>
  )
}
