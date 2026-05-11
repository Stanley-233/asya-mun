'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/contexts/auth-context'
import { SecretMessageList, MessageDetailDialog } from '@/components/message'
import { buildLoginRedirect } from '@/lib/auth/return-to'
import type { MessageResponse } from '@/lib/api/generated'

export default function MyMessagesPage() {
  const router = useRouter()
  const { user, isLoading, isAuthenticated } = useAuth()

  const [selectedMessageUuid, setSelectedMessageUuid] = useState<string | null>(null)
  const [messageDetailOpen, setMessageDetailOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(buildLoginRedirect())
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role !== 'DELEGATE') {
      router.push('/progress')
    }
  }, [isLoading, isAuthenticated, user?.role, router])

  const handleMessageClick = (msg: MessageResponse) => {
    setSelectedMessageUuid(msg.uuid)
    setMessageDetailOpen(true)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-lg text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role !== 'DELEGATE') return null

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>我的非对称消息</CardTitle>
          <CardDescription>查看您接收的私密消息</CardDescription>
        </CardHeader>
        <CardContent>
          <SecretMessageList onMessageClick={handleMessageClick} />
        </CardContent>
      </Card>

      <MessageDetailDialog
        open={messageDetailOpen}
        onOpenChange={setMessageDetailOpen}
        messageUuid={selectedMessageUuid}
      />
    </div>
  )
}
