import { createRoot, type Root } from 'react-dom/client'
import type { ReactNode } from 'react'
import { EXTENSION_CHANNEL, type ExtensionContext, type ExtensionMessage } from './protocol'

export type { ExtensionContext, ExtensionManifest } from './protocol'

function extensionId() {
  const id = document.documentElement.dataset.extensionId
  if (!id) throw new Error('Missing extension ID in entry document')
  return id
}

function send(message: ExtensionMessage) {
  if (window.parent !== window) window.parent.postMessage(message, window.location.origin)
}

export function notify(message: string, level: 'info' | 'warning' | 'error' | 'success' = 'info') {
  send({ channel: EXTENSION_CHANNEL, id: extensionId(), type: 'notify', message, level })
}

export const storage = {
  get<T>(key: string): T | null {
    try { return JSON.parse(localStorage.getItem(`asya.extension.${extensionId()}.${key}`) ?? 'null') as T | null }
    catch { return null }
  },
  set(key: string, value: unknown) {
    try { localStorage.setItem(`asya.extension.${extensionId()}.${key}`, JSON.stringify(value)) }
    catch { /* A storage quota failure does not prevent use of the tool. */ }
  },
}

/** Mount an isolated React tool and return a disposer for all SDK-owned resources. */
export function mountExtension(content: ReactNode, onContext?: (context: ExtensionContext) => void) {
  const element = document.getElementById('root')
  if (!element) throw new Error('Missing extension root element')
  const id = extensionId()
  let root: Root | null = createRoot(element)
  root.render(content)
  let frame = 0
  const resize = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => send({ channel: EXTENSION_CHANNEL, id, type: 'resize', height: element.scrollHeight + 32 }))
  }
  const observer = new ResizeObserver(resize)
  observer.observe(element)
  const receive = (event: MessageEvent<ExtensionMessage>) => {
    if (event.source !== window.parent || event.origin !== window.location.origin
        || event.data?.channel !== EXTENSION_CHANNEL || event.data.id !== id) return
    if (event.data.type === 'context') onContext?.(event.data.context)
  }
  window.addEventListener('message', receive)
  const dispose = () => {
    observer.disconnect()
    cancelAnimationFrame(frame)
    window.removeEventListener('message', receive)
    window.removeEventListener('pagehide', dispose)
    root?.unmount()
    root = null
  }
  window.addEventListener('pagehide', dispose, { once: true })
  send({ channel: EXTENSION_CHANNEL, id, type: 'ready' })
  resize()
  return dispose
}
