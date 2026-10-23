'use client'

import { useQuery } from '@tanstack/react-query'
import { apiRequester } from '@/lib/api/client'
import type { ExtensionManifest } from '../../../packages/extension-sdk/src/protocol'

export type { ExtensionManifest } from '../../../packages/extension-sdk/src/protocol'

export function extensionHref(id: string) {
  return `/extensions?id=${encodeURIComponent(id)}`
}

export function useExtensions(enabled: boolean) {
  return useQuery({
    queryKey: ['extensions'],
    queryFn: () => apiRequester.requestProtected<ExtensionManifest[]>({ method: 'GET', path: '/api/extensions' }),
    enabled,
    staleTime: 0,
    refetchInterval: 30_000,
  })
}
