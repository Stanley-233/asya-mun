'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ApiExample } from "@/lib/api/example-usage"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"

export function WelcomeComponent() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [showScrollHint, setShowScrollHint] = useState(true)

  useEffect(() => {
    setMounted(true)
    const handleScroll = () => {
      if (window.scrollY > 100) {
        setShowScrollHint(false)
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToLogin = () => {
    document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="h-screen flex flex-col items-center justify-center relative px-4">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          {/* Main Title with Fade In Animation */}
          <div 
            className={`space-y-4 transition-all duration-1000 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <h1 className="text-8xl md:text-9xl font-black tracking-tighter bg-gradient-to-br from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent animate-fade-in">
              ASYA
            </h1>
            <div className="space-y-2">
              <p className="text-2xl md:text-3xl font-light tracking-wide text-muted-foreground">
                <span className="font-bold text-foreground">A</span>symmetric{' '}
                <span className="font-bold text-foreground">SY</span>nergy{' '}
                <span className="font-bold text-foreground">A</span>utomation
              </p>
              <p className="text-xl md:text-2xl font-light text-muted-foreground/80">
                非对称联动推演自动化系统
              </p>
            </div>
          </div>

          {/* Animated Divider */}
          <div 
            className={`flex justify-center transition-all duration-1000 delay-300 ${
              mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
            }`}
          >
            <div className="h-1 w-32 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full animate-pulse" />
          </div>

          {/* Description */}
          <p 
            className={`text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto transition-all duration-1000 delay-500 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            用于模拟联合国联动体系的一站式解决方案
          </p>
        </div>

        {/* Scroll Hint */}
        {showScrollHint && (
          <button
            onClick={scrollToLogin}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-all duration-300 group cursor-pointer animate-bounce"
          >
            <span className="text-sm">下滑登录</span>
            <ChevronDown className="w-6 h-6 group-hover:translate-y-1 transition-transform" />
          </button>
        )}
      </section>

      {/* Login Section */}
      <section id="login-section" className="min-h-screen flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full space-y-8">
          <Card className="backdrop-blur-sm bg-card/50 border-primary/20 shadow-2xl">
            <CardHeader className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">A</span>
                </div>
              </div>
              <CardTitle className="text-3xl font-bold">欢迎回来</CardTitle>
              <CardDescription>
                登录以访问 ASYA 系统
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    用户名
                  </label>
                  <input
                    type="text"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                    placeholder="请输入用户名"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    密码
                  </label>
                  <input
                    type="password"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                    placeholder="请输入密码"
                  />
                </div>
              </div>
              <Button 
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => router.push('/login')}
              >
                登录
              </Button>
              <div className="text-center">
                <CardDescription className="text-xs">
                  或{' '}
                  <button className="text-primary hover:underline font-medium" onClick={() => router.push('/login')}>
                    前往完整登录页面
                  </button>
                </CardDescription>
              </div>
            </CardContent>
          </Card>

          {/* API Status Card */}
          <Card className="backdrop-blur-sm bg-card/50 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">系统状态</CardTitle>
              <CardDescription>
                后端 API 连接状态
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ApiExample />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}


export default function Page() {
  return <WelcomeComponent />
}