'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'react-toastify'
import { useAuth } from '@/lib/contexts/auth-context'
import { buildLoginRedirect } from '@/lib/auth/return-to'
import { extensionHref, useExtensions, type ExtensionManifest } from '@/lib/extensions/registry'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EXTENSION_CHANNEL, type ExtensionContext, type ExtensionMessage } from '../../../packages/extension-sdk/src/protocol'

function ExtensionFrame({ extension, context }: { extension: ExtensionManifest; context: ExtensionContext }) {
  const iframe = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(600)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const sendContext = () => iframe.current?.contentWindow?.postMessage({
      channel: EXTENSION_CHANNEL, id: extension.id, type: 'context', context,
    } satisfies ExtensionMessage, window.location.origin)
    const receive = (event: MessageEvent<ExtensionMessage>) => {
      if (event.source !== iframe.current?.contentWindow || event.origin !== window.location.origin
          || event.data?.channel !== EXTENSION_CHANNEL || event.data.id !== extension.id) return
      if (event.data.type === 'ready') {
        setReady(true)
        setFailed(false)
        sendContext()
      } else if (event.data.type === 'resize' && Number.isFinite(event.data.height)) {
        setHeight(Math.max(400, Math.min(30_000, event.data.height)))
      } else if (event.data.type === 'notify' && typeof event.data.message === 'string') {
        const level = event.data.level
        if (['info', 'warning', 'error', 'success'].includes(level)) toast[level](event.data.message.slice(0, 2000))
      }
    }
    window.addEventListener('message', receive)
    sendContext()
    return () => window.removeEventListener('message', receive)
  }, [extension.id, context])

  useEffect(() => {
    if (ready) return
    const timer = window.setTimeout(() => setFailed(true), 15_000)
    return () => window.clearTimeout(timer)
  }, [ready])

  return <>
    {!ready && <p className="px-4 text-sm text-muted-foreground" role="status">{failed ? '扩展未能启动，请刷新页面重试。' : '正在加载扩展…'}</p>}
    <iframe ref={iframe} title={extension.name}
      src={`/extension/${encodeURIComponent(extension.id)}/${extension.frontend.entry}`}
      sandbox="allow-scripts allow-same-origin" referrerPolicy="same-origin"
      className="w-full border-0" style={{ height }} onError={() => setFailed(true)} />
  </>
}

export function ExtensionHost() {
  const router = useRouter()
  const search = useSearchParams()
  const id = search.get('id')
  const { user, isLoading, isAuthenticated } = useAuth()
  const catalog = useExtensions(isAuthenticated)
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace(buildLoginRedirect())
  }, [isLoading, isAuthenticated, router])

  if (isLoading || !isAuthenticated || catalog.isPending) return <p className="p-8 text-muted-foreground">加载中…</p>
  if (catalog.isError) return <div className="p-8"><p>无法读取扩展列表。</p><button className="mt-3 underline" onClick={() => void catalog.refetch()}>重试</button></div>
  const extension = catalog.data.find(item => item.id === id)
  if (id && !extension) return <div className="p-8"><h1 className="text-xl font-semibold">扩展不可用</h1><p className="mt-2 text-muted-foreground">该扩展尚未安装或已被禁用。</p><Link className="mt-4 inline-block underline" href="/extensions">查看可用扩展</Link></div>
  if (!extension) return <div className="space-y-5 p-8"><h1 className="text-2xl font-semibold">扩展</h1>{catalog.data.length === 0 && <p>当前没有启用的扩展。</p>}<div className="grid gap-4 md:grid-cols-2">{catalog.data.map(item => <Link key={item.id} href={extensionHref(item.id)}><Card><CardHeader><CardTitle>{item.name}</CardTitle><CardDescription>{item.description}</CardDescription></CardHeader></Card></Link>)}</div></div>

  const context: ExtensionContext = {
    user: user ? { id: user.uuid, name: user.displayName || user.name, role: user.role } : null,
    conferenceId: user?.conferenceUuid ?? null,
  }
  return <div className="space-y-4 py-8"><div className="px-4"><Card><CardHeader><CardTitle>{extension.name}</CardTitle><CardDescription>{extension.description}</CardDescription></CardHeader></Card></div><ExtensionFrame key={`${extension.id}@${extension.version}`} extension={extension} context={context} /></div>
}
