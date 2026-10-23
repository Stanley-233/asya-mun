export const EXTENSION_CHANNEL = 'asya.extension.v1'

export interface ExtensionManifest {
  schemaVersion: 1
  hostApiVersion: 1
  id: string
  name: string
  version: string
  author: string
  description?: string
  frontend: { entry: string; icon?: string }
  permissions?: string[]
}

export interface ExtensionContext {
  user: { id: string; name: string; role: string } | null
  conferenceId: string | null
}

export type ExtensionMessage = {
  channel: typeof EXTENSION_CHANNEL
  id: string
} & (
  | { type: 'ready' }
  | { type: 'resize'; height: number }
  | { type: 'notify'; message: string; level: 'info' | 'warning' | 'error' | 'success' }
  | { type: 'context'; context: ExtensionContext }
)
