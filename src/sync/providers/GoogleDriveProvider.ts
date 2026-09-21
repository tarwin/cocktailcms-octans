import type { SyncProvider, SyncProviderType } from '../types'

// The OAuth client used by the original cocktailcms.com deployment. Set
// VITE_GOOGLE_CLIENT_ID to use your own when hosting elsewhere.
const CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ||
  '890261015416-0nai40iah9a1bhvhelpmamr73d8pe2e0.apps.googleusercontent.com'
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const TOKEN_KEY = 'cocktail.gdrive.token'

interface StoredToken {
  access_token: string
  expires_at: number
}

let gisLoading: Promise<void> | null = null

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisLoading) return gisLoading
  gisLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Could not load Google Identity Services'))
    document.head.appendChild(s)
  })
  return gisLoading
}

/**
 * Keeps the database in a "CocktailCMS Data" folder of the user's Google
 * Drive, using Google Identity Services for the token and the Drive REST API
 * directly for files (no gapi client library).
 */
export class GoogleDriveProvider implements SyncProvider {
  readonly type: SyncProviderType = 'google-drive'
  readonly name = 'Google Drive'
  private folderName = 'CocktailCMS Data'
  private folderId = ''

  private get token(): StoredToken | null {
    try {
      const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null') as StoredToken | null
      if (t && t.expires_at > Date.now() + 30_000) return t
    } catch {
      /* ignore */
    }
    return null
  }

  private set token(t: StoredToken | null) {
    if (t) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t))
    else sessionStorage.removeItem(TOKEN_KEY)
  }

  async isSignedIn() {
    return !!this.token
  }

  async signIn() {
    await loadGis()
    await new Promise<void>((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (resp: any) => {
          if (resp.error) return reject(new Error(resp.error))
          this.token = { access_token: resp.access_token, expires_at: Date.now() + (resp.expires_in || 3600) * 1000 }
          resolve()
        },
        error_callback: (err: any) => reject(new Error(err?.message || 'Sign in cancelled')),
      })
      client.requestAccessToken()
    })
  }

  async signOut() {
    const t = this.token
    this.token = null
    this.folderId = ''
    if (t && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(t.access_token, () => {})
      } catch {
        /* ignore */
      }
    }
  }

  private async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    const t = this.token
    if (!t) throw new Error('Not signed in to Google Drive')
    const res = await fetch(url, {
      ...init,
      headers: { ...(init.headers || {}), Authorization: `Bearer ${t.access_token}` },
    })
    if (res.status === 401) {
      this.token = null
      throw Object.assign(new Error('Google Drive session expired. Please reconnect.'), { status: 401 })
    }
    if (!res.ok) throw Object.assign(new Error(`Google Drive error ${res.status}`), { status: res.status })
    return res
  }

  private async list(q: string): Promise<Array<{ id: string; name: string }>> {
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`
    const json = await (await this.fetch(url)).json()
    return json.files || []
  }

  private async ensureFolder(): Promise<string> {
    if (this.folderId) return this.folderId
    const found = await this.list(`mimeType='application/vnd.google-apps.folder' and name='${this.folderName}' and trashed=false`)
    if (found.length) {
      this.folderId = found[0].id
    } else {
      const res = await this.fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.folderName, mimeType: 'application/vnd.google-apps.folder' }),
      })
      this.folderId = (await res.json()).id
    }
    return this.folderId
  }

  private async findFile(name: string) {
    const folderId = await this.ensureFolder()
    const found = await this.list(`'${folderId}' in parents and name='${name.replace(/'/g, "\\'")}' and trashed=false`)
    return found[0] || null
  }

  async readBytes(name: string) {
    const file = await this.findFile(name)
    if (!file) return null
    const res = await this.fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`)
    return new Uint8Array(await res.arrayBuffer())
  }

  async writeBytes(name: string, bytes: Uint8Array, mime: string) {
    const folderId = await this.ensureFolder()
    const existing = await this.findFile(name)
    const metadata: Record<string, any> = { name, mimeType: mime }
    if (!existing) metadata.parents = [folderId]
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', new Blob([bytes as BlobPart], { type: mime }))
    const url = existing
      ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id'
    await this.fetch(url, { method: existing ? 'PATCH' : 'POST', body: form })
  }

  async readText(name: string) {
    const b = await this.readBytes(name)
    return b ? new TextDecoder().decode(b) : null
  }

  async writeText(name: string, text: string, mime: string) {
    await this.writeBytes(name, new TextEncoder().encode(text), mime)
  }
}
