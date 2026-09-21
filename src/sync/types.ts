export type SyncProviderType = 'google-drive' | 'puter'

export interface SyncSettings {
  version: number
  type: SyncProviderType | null
  lastSyncId: string
  lastUpdated: number
}

/**
 * A place that can hold a couple of files. The sync manager stores the whole
 * SQLite database as one file plus a small JSON marker beside it, so a
 * provider only needs read/write by name inside one folder.
 */
export interface SyncProvider {
  readonly type: SyncProviderType
  readonly name: string
  isSignedIn(): Promise<boolean>
  signIn(): Promise<void>
  signOut(): Promise<void>
  readBytes(name: string): Promise<Uint8Array | null>
  writeBytes(name: string, bytes: Uint8Array, mime: string): Promise<void>
  readText(name: string): Promise<string | null>
  writeText(name: string, text: string, mime: string): Promise<void>
}
