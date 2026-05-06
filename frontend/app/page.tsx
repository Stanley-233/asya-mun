'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, ArrowRight, BookOpenCheck, LoaderCircle, Network, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TermsDialog } from '@/components/terms-dialog'
// import { ApiExample } from '@/lib/api/example-usage'
import { useAuth } from '@/lib/contexts/auth-context'
import { getSafeReturnTo, RETURN_TO_STORAGE_KEY } from '@/lib/auth/return-to'
import { login, register, useGetRegistrationSwitch } from '@/lib/api/hooks/user'
import { UserRegistrationRequestRole } from '@/lib/api/generated'
import { parseApiPayload } from '@/lib/api/response-utils'
import { toast } from 'react-toastify'

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
const DEFAULT_AUTH_REDIRECT = '/progress'

const systemNotes = [
  {
    title: '联动推演',
    description: '以更清晰的节奏组织议程、角色和事件流，让推演链路保持连贯。',
    icon: BookOpenCheck,
  },
  {
    title: '流程协同',
    description: '把指令分发、状态反馈和非对称消息整理成统一节拍。',
    icon: Network,
  },
  {
    title: '信息整合',
    description: '集中呈现关键状态与互动信号，帮助主持团队快速响应。',
    icon: ShieldCheck,
  },
]

export default function Page() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [allowRegister, setAllowRegister] = useState(true)
  const [termsOpen, setTermsOpen] = useState(false)
  const [pendingRedirect, setPendingRedirect] = useState(false)

  const {
    data: registrationSwitchData,
    isLoading: registrationSwitchLoading,
    error: registrationSwitchError,
  } = useGetRegistrationSwitch({
    query: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  })

  const [loginForm, setLoginForm] = useState({
    name: '',
    password: '',
  })

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

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      window.location.replace(DEFAULT_AUTH_REDIRECT)
    }
  }, [authLoading, isAuthenticated])

  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8080'
  const backendStatus = registrationSwitchLoading
    ? {
        label: '连接检测中',
        detail: '正在确认后端服务响应状态',
        tone: 'text-amber-700',
        badge: 'bg-amber-500',
        Icon: LoaderCircle,
        iconClassName: 'animate-spin',
      }
    : registrationSwitchError
      ? {
          label: '后端未连接',
          detail: '当前无法访问认证服务，请检查后端是否启动',
          tone: 'text-red-700',
          badge: 'bg-red-500',
          Icon: AlertCircle,
          iconClassName: '',
        }
      : {
          label: '后端已连接',
          detail: allowRegister ? '认证服务响应正常，当前允许注册' : '认证服务响应正常，当前暂停注册',
          tone: 'text-emerald-700',
          badge: 'bg-emerald-500',
          Icon: ShieldCheck,
          iconClassName: '',
        };

  const BackendStatusIcon = backendStatus.Icon

  const finishLogin = () => {
    const searchParams = new URLSearchParams(window.location.search)
    const queryReturnTo = getSafeReturnTo(searchParams.get('returnTo'))
    const storedReturnTo = getSafeReturnTo(sessionStorage.getItem(RETURN_TO_STORAGE_KEY))
    const nextPath = queryReturnTo || storedReturnTo || DEFAULT_AUTH_REDIRECT

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
      const responseData = parseApiPayload<{ token?: string }>(response)
      const token = responseData?.token

      if (token) {
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(responseData))
        handleAuthSuccess('登录成功，正在进入工作台...')
      } else {
        toast.error('登录成功但未获取到 Token')
      }
    } catch (err: unknown) {
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
      await register({
        name: registerForm.name,
        displayName: registerForm.displayName?.trim() || undefined,
        password: registerForm.password,
        role: registerForm.role,
      })

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
        handleAuthSuccess('注册成功，正在进入工作台...')
      } else {
        toast.warning('注册成功，但自动登录失败，请手动登录')
        setTab('login')
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '注册失败，请重试'))
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <p className="text-sm font-semibold tracking-[0.18em] text-primary/70 uppercase">ASYA</p>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(250,247,241,0.92)_32%,_rgba(244,239,230,0.82)_60%,_rgba(255,255,255,0.96)_100%)] px-5 py-8 text-foreground sm:px-8 lg:px-12">
      <div className="asya-grid pointer-events-none absolute inset-0 opacity-50" />
      <div className="asya-noise pointer-events-none absolute inset-0 opacity-35" />
      <div className="asya-glow pointer-events-none absolute left-1/2 top-0 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/3 opacity-75" />
      <div className="asya-glow pointer-events-none left-[8%] top-[24%] hidden h-64 w-64 opacity-50 md:absolute md:block" />
      <div className="asya-glow pointer-events-none right-[6%] top-[60%] hidden h-72 w-72 opacity-45 md:absolute md:block" />
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.78fr)]">
        <section className="asya-panel relative rounded-xl border border-primary/20 bg-card/68 p-6 shadow-[0_18px_56px_rgba(142,99,30,0.11)] backdrop-blur-xl sm:p-7 lg:p-8">
          <div className="lg:pr-[19rem]">
            <p className="text-xs font-bold tracking-[0.28em] text-primary/75 uppercase">ASYA SYSTEM</p>
            <h1 className="mt-4 bg-gradient-to-b from-primary via-[color:rgba(184,132,52,0.9)] to-[color:rgba(111,78,27,0.78)] bg-clip-text text-4xl font-black tracking-tight text-transparent drop-shadow-[0_18px_48px_rgba(155,109,35,0.14)] sm:text-5xl">
              ASYA
            </h1>
            <h1 className="mt-4 bg-gradient-to-b from-primary via-[color:rgba(184,132,52,0.9)] to-[color:rgba(111,78,27,0.78)] bg-clip-text text-4xl font-black tracking-tight text-transparent drop-shadow-[0_18px_48px_rgba(155,109,35,0.14)] sm:text-4xl">
              非对称联动推演自动化系统
            </h1>
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium tracking-[0.12em] text-foreground/88 uppercase sm:text-base">
                <span className="font-bold text-foreground">A</span>symmetric{' '}
                <span className="font-bold text-foreground">SY</span>nergy{' '}
                <span className="font-bold text-foreground">A</span>utomation System
              </p>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                模拟联合国联动体系的一站式解决方案，连接会议节奏、学团代表交互、信息流转。
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-primary/15 bg-background/60 p-3 shadow-[0_12px_28px_rgba(142,99,30,0.07)] backdrop-blur-md sm:max-w-[19rem] lg:absolute lg:right-8 lg:top-8 lg:mt-0 lg:w-[17rem]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold tracking-[0.22em] text-primary/70 uppercase">
                Backend
              </p>
              <div className="flex items-center gap-2 rounded-full border border-primary/15 bg-background/80 px-2 py-1">
                <span className={`size-1.5 rounded-full ${backendStatus.badge}`} />
                <BackendStatusIcon className={`size-3.5 ${backendStatus.tone} ${backendStatus.iconClassName}`} />
              </div>
            </div>
            <p className={`mt-2 text-sm font-semibold ${backendStatus.tone}`}>
              {backendStatus.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {backendStatus.detail}
            </p>
            <p className="mt-3 truncate text-[11px] text-foreground/75" title={backendBaseUrl}>
              {backendBaseUrl}
            </p>
          </div>

          {/* <div className="mt-6 rounded-xl border border-primary/15 bg-background/58 p-2 shadow-[0_14px_42px_rgba(142,99,30,0.08)]">
            <ApiExample />
          </div> */}

          <div className="mt-6 divide-y divide-border/70">
            {systemNotes.map(({ title, description, icon: Icon }) => (
              <div key={title} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary shadow-[0_0_24px_rgba(184,132,52,0.12)]">
                  <Icon className="size-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">{title}</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="asya-panel rounded-xl border border-primary/20 bg-card/82 p-6 shadow-[0_18px_56px_rgba(142,99,30,0.13)] backdrop-blur-xl sm:p-7">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary/75">欢迎回来</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            权限认证
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            登录后进入你的会议与指令界面。
          </p>

          <div className={`mt-6 grid rounded-lg border border-primary/20 bg-primary/5 p-1 ${allowRegister ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <button
              type="button"
              onClick={() => setTab('login')}
              className={`h-8 rounded-md text-sm font-medium transition-all ${
                tab === 'login'
                  ? 'bg-background text-foreground shadow-[0_6px_18px_rgba(142,99,30,0.10)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              登录
            </button>
            {allowRegister && (
              <button
                type="button"
                onClick={() => setTab('register')}
                className={`h-8 rounded-md text-sm font-medium transition-all ${
                  tab === 'register'
                    ? 'bg-background text-foreground shadow-[0_6px_18px_rgba(142,99,30,0.10)]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                注册
              </button>
            )}
          </div>

          {tab === 'login' && (
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-name">
                  用户昵称
                </Label>
                <Input
                  id="login-name"
                  placeholder="请输入用户昵称"
                  value={loginForm.name}
                  onChange={(e) => setLoginForm({ ...loginForm, name: e.target.value })}
                  disabled={loading}
                  autoComplete="username"
                  className="border-primary/20 bg-background/65 focus-visible:ring-primary/35"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">
                  密码
                </Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="请输入密码"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  disabled={loading}
                  autoComplete="current-password"
                  className="border-primary/20 bg-background/65 focus-visible:ring-primary/35"
                />
              </div>

              <Button
                type="submit"
                className="mt-2 w-full shadow-[0_12px_26px_rgba(142,99,30,0.16)] hover:bg-primary/90"
                disabled={loading}
              >
                {loading ? '登录中...' : '登录并进入系统'}
                {!loading && <ArrowRight className="size-4" />}
              </Button>
            </form>
          )}

          {tab === 'register' && allowRegister && (
            <form onSubmit={handleRegister} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-name">
                  用户昵称
                </Label>
                <Input
                  id="register-name"
                  placeholder="请输入用户昵称"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  disabled={loading}
                  autoComplete="username"
                  className="border-primary/20 bg-background/65 focus-visible:ring-primary/35"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-display-name">
                  显示名称（可选）
                </Label>
                <Input
                  id="register-display-name"
                  placeholder="请输入显示名称"
                  value={registerForm.displayName}
                  onChange={(e) => setRegisterForm({ ...registerForm, displayName: e.target.value })}
                  disabled={loading}
                  autoComplete="nickname"
                  className="border-primary/20 bg-background/65 focus-visible:ring-primary/35"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="register-password">
                    密码
                  </Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="至少 6 个字符"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    disabled={loading}
                    autoComplete="new-password"
                    className="border-primary/20 bg-background/65 focus-visible:ring-primary/35"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">
                    确认密码
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="再次输入密码"
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                    disabled={loading}
                    autoComplete="new-password"
                    className="border-primary/20 bg-background/65 focus-visible:ring-primary/35"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">
                  用户角色
                </Label>
                <select
                  id="role"
                  value={registerForm.role}
                  onChange={(e) => setRegisterForm({ ...registerForm, role: e.target.value as UserRegistrationRequestRole })}
                  disabled={loading}
                  className="h-8 w-full rounded-lg border border-primary/20 bg-background/65 px-2.5 py-1 text-sm text-foreground outline-none transition focus:ring-[3px] focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="DM">DM</option>
                  <option value="DH">DH</option>
                  <option value="DELEGATE">DELEGATE</option>
                  <option value="SYS_ADMIN">SYS_ADMIN</option>
                </select>
              </div>

              <Button
                type="submit"
                className="mt-2 w-full shadow-[0_12px_26px_rgba(142,99,30,0.16)] hover:bg-primary/90"
                disabled={loading}
              >
                {loading ? '注册中...' : '注册并进入系统'}
                {!loading && <ArrowRight className="size-4" />}
              </Button>
            </form>
          )}

          <div className="mt-6 flex justify-center">
            <TermsDialog variant="link" />
          </div>

          <TermsDialog
            open={termsOpen}
            onOpenChange={handleTermsOpenChange}
            showTrigger={false}
            confirmLabel="确认并进入系统"
          />
        </section>
      </div>
    </main>
  )
}
