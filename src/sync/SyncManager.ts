import type { Api } from '@/api/Api'
import { EventBus } from '@/core/bus'
import { platform } from '@/core/platform'
import { debounce, safeJson } from '@/core/utils'
import { GoogleDriveProvider } from './providers/GoogleDriveProvider'
import { PuterProvider } from './providers/PuterProvider'
import type { SyncProvider, SyncProviderType, SyncSettings } from './types'

const SETTINGS_KEY = 'cocktail.sync.settings'
const DB_FILE = 'cocktailcms.sqlite3'
const MARKER_FILE = 'cocktailcms.sync.json'

export type SyncDirection = 'localToRemote' | 'remoteToLocal'

/**
 * Keeps a copy of the whole database in a cloud provider.
 *
 * The remote side is two files: the SQLite image and a marker with a random
 * `lastSyncId` plus a timestamp. Local and remote agreeing on `lastSyncId`
 * means they hold the same data; if they disagree the user picks a direction
 * (the `conflict` event). After every local change the database is pushed
 * again, debounced.
 *
 * Events on `bus`: `connector-change`, `start-working`, `stop-working`,
 * `conflict` (localTime, remoteTime, resolve(direction)), `error` (message),
 * `pulled`.
 */
export class SyncManager {
  readonly bus = new EventBus()
  private settings: SyncSettings = { version: 2, type: null, lastSyncId: '', lastUpdated: 0 }
  private provider: SyncProvider | null = null
  private ready = false
  private dirty = false
  private pushing = false
  private pushSoon = debounce(() => void this.pushIfDirty(), 2000)

  constructor(private api: Api) {
    this.api.bus.on('changed', () => {
      if (!this.provider) return
      this.dirty = true
      if (this.ready) this.pushSoon()
    })
  }

  async init() {
    this.loadSettings()
    if (this.settings.type) {
      this.provider = this.createProvider(this.settings.type)
      if (await this.provider.isSignedIn()) {
        void this.initSync()
      } else {
        // token gone (session ended) - keep the choice, wait for reconnect
        this.bus.emit('connector-change')
      }
    }
  }

  hasProvider() {
    return !!this.provider
  }
  providerName() {
    return this.provider?.name || ''
  }
  providerType() {
    return this.provider?.type || null
  }
  isReady() {
    return this.ready
  }
  isDirty() {
    return this.dirty
  }
  lastUpdated() {
    return this.settings.lastUpdated
  }

  availableProviders(): Array<{ type: SyncProviderType; name: string; recommended: boolean }> {
    return [
      { type: 'puter', name: 'Puter', recommended: platform === 'puter' },
      { type: 'google-drive', name: 'Google Drive', recommended: false },
    ]
  }

  async isSignedIn() {
    return this.provider ? this.provider.isSignedIn() : false
  }

  async connectTo(type: SyncProviderType): Promise<boolean> {
    const provider = this.createProvider(type)
    try {
      if (!(await provider.isSignedIn())) await provider.signIn()
    } catch (e: any) {
      this.bus.emit('error', e?.message || 'Could not sign in')
      return false
    }
    this.provider = provider
    this.settings.type = type
    this.saveSettings()
    this.bus.emit('connector-change')
    await this.initSync()
    return true
  }

  async reconnect(): Promise<boolean> {
    if (!this.settings.type) return false
    return this.connectTo(this.settings.type)
  }

  async disconnect(keepRemote = true) {
    this.pushSoon.cancel()
    this.ready = false
    if (this.provider) {
      try {
        await this.provider.signOut()
      } catch {
        /* ignore */
      }
    }
    this.provider = null
    this.settings = { version: 2, type: null, lastSyncId: '', lastUpdated: 0 }
    this.saveSettings()
    this.bus.emit('connector-change')
    void keepRemote
  }

  /** Forces a full push now (e.g. from a "Sync now" button). */
  async pushNow() {
    this.dirty = true
    await this.pushIfDirty(true)
  }

  async pullNow() {
    await this.doFullSyncToLocal()
  }

  // -------------------------------------------------------------- internals
  private createProvider(type: SyncProviderType): SyncProvider {
    switch (type) {
      case 'google-drive':
        return new GoogleDriveProvider()
      case 'puter':
        return new PuterProvider()
      default:
        throw new Error(`Unknown sync provider "${type}"`)
    }
  }

  private loadSettings() {
    try {
      const s = safeJson<SyncSettings>(window.localStorage.getItem(SETTINGS_KEY))
      if (s && s.version === 2) this.settings = s
    } catch {
      /* ignore */
    }
  }

  private saveSettings() {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings))
    } catch {
      /* ignore */
    }
  }

  private async readRemoteMarker(): Promise<SyncSettings | null> {
    if (!this.provider) return null
    const text = await this.provider.readText(MARKER_FILE)
    return safeJson<SyncSettings>(text)
  }

  private async initSync() {
    if (!this.provider) return
    this.bus.emit('start-working')
    let remote: SyncSettings | null
    try {
      remote = await this.readRemoteMarker()
    } catch (e: any) {
      this.bus.emit('stop-working')
      this.bus.emit('error', e?.message || 'Could not reach the sync provider')
      return
    }
    this.bus.emit('stop-working')

    if (!remote?.lastSyncId) {
      await this.doFullSyncToRemote()
      this.ready = true
      return
    }
    if (remote.lastSyncId === this.settings.lastSyncId) {
      this.ready = true
      if (this.dirty) this.pushSoon()
      return
    }
    // both sides have data and they differ - ask
    const hasLocal = this.settings.lastSyncId !== '' || (await this.localHasData())
    if (!hasLocal) {
      await this.doFullSyncToLocal()
      this.ready = true
      return
    }
    this.bus.emit('conflict', this.settings.lastUpdated, remote.lastUpdated, async (direction: SyncDirection) => {
      if (direction === 'remoteToLocal') await this.doFullSyncToLocal()
      else await this.doFullSyncToRemote()
      this.ready = true
    })
  }

  private async localHasData(): Promise<boolean> {
    const schemas = await this.api.getSchemaList()
    return schemas.length > 0
  }

  private newMarker(): SyncSettings {
    this.settings.lastSyncId = crypto.randomUUID()
    this.settings.lastUpdated = Date.now()
    this.saveSettings()
    return { ...this.settings }
  }

  private async pushIfDirty(force = false) {
    if (!this.provider || (!this.ready && !force) || this.pushing) return
    if (!this.dirty && !force) return
    this.pushing = true
    this.dirty = false
    this.bus.emit('start-working')
    try {
      // guard against another device having pushed since we last synced
      const remote = await this.readRemoteMarker()
      if (remote?.lastSyncId && this.settings.lastSyncId && remote.lastSyncId !== this.settings.lastSyncId) {
        this.ready = false
        this.bus.emit('conflict', this.settings.lastUpdated, remote.lastUpdated, async (direction: SyncDirection) => {
          if (direction === 'remoteToLocal') await this.doFullSyncToLocal()
          else await this.doFullSyncToRemote()
          this.ready = true
        })
        return
      }
      const bytes = await this.api.exportDatabase()
      await this.provider.writeBytes(DB_FILE, bytes, 'application/vnd.sqlite3')
      const marker = this.newMarker()
      await this.provider.writeText(MARKER_FILE, JSON.stringify(marker, null, 2), 'application/json')
    } catch (e: any) {
      this.dirty = true
      this.bus.emit('error', e?.message || 'Sync failed')
    } finally {
      this.pushing = false
      this.bus.emit('stop-working')
    }
  }

  private async doFullSyncToRemote() {
    if (!this.provider) return
    this.pushing = true
    this.bus.emit('start-working')
    try {
      const bytes = await this.api.exportDatabase()
      await this.provider.writeBytes(DB_FILE, bytes, 'application/vnd.sqlite3')
      const marker = this.newMarker()
      await this.provider.writeText(MARKER_FILE, JSON.stringify(marker, null, 2), 'application/json')
      this.dirty = false
    } catch (e: any) {
      this.bus.emit('error', e?.message || 'Sync failed')
    } finally {
      this.pushing = false
      this.bus.emit('stop-working')
    }
  }

  private async doFullSyncToLocal() {
    if (!this.provider) return
    this.bus.emit('start-working')
    try {
      const [bytes, marker] = await Promise.all([this.provider.readBytes(DB_FILE), this.readRemoteMarker()])
      if (!bytes || !marker) throw new Error('No database found in the sync folder')
      await this.api.importDatabase(bytes)
      this.settings = { ...this.settings, lastSyncId: marker.lastSyncId, lastUpdated: marker.lastUpdated }
      this.saveSettings()
      this.dirty = false
      this.bus.emit('pulled')
    } catch (e: any) {
      this.bus.emit('error', e?.message || 'Sync failed')
    } finally {
      this.bus.emit('stop-working')
    }
  }
}
