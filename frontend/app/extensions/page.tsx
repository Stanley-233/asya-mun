import { Suspense } from 'react'
import { ExtensionHost } from '@/components/extensions/extension-host'

export default function ExtensionsPage() {
  return <Suspense fallback={<p className="p-8 text-muted-foreground">加载中…</p>}><ExtensionHost /></Suspense>
}
