'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dices } from 'lucide-react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DiceRoller } from '@/components/dice-roller/dice-roller'
import { useAuth } from '@/lib/contexts/auth-context'
import { buildLoginRedirect } from '@/lib/auth/return-to'

export default function DicePage() {
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
                <Dices className="size-5" />
              </div>
              <div>
                <CardTitle>骰娘</CardTitle>
                <CardDescription>DLC 扩展内容 - 骰子投掷与成功率判定工具</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <DiceRoller />
      </div>
    </div>
  )
}
