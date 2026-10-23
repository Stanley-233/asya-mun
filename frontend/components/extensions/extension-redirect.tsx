'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { extensionHref } from '@/lib/extensions/registry'

export function ExtensionRedirect({ id }: { id: string }) {
  const router = useRouter()
  useEffect(() => { router.replace(extensionHref(id)) }, [id, router])
  return <p className="p-8 text-muted-foreground">正在打开扩展…</p>
}
