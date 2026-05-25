'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Swords } from 'lucide-react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QuickCalculator } from '@/components/status-manage/quick-calculator'
import { useAuth } from '@/lib/contexts/auth-context'
import { buildLoginRedirect } from '@/lib/auth/return-to'

export default function MedievalStrategyPage() {
  const router = useRouter()
  const { isLoading, isAuthenticated } = useAuth()

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push(buildLoginRedirect())
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-lg text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Swords className="size-5" />
              </div>
              <div>
                <CardTitle>中世纪战略推演</CardTitle>
                <CardDescription>DLC 扩展内容 - 快捷战斗计算器与战术推演工具</CardDescription>
                <CardDescription>原用于 RUCMUNC 21st 历史联动委员会 · 1269 亚欧局势联动</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <QuickCalculator />
      </div>
    </div>
  )
}
