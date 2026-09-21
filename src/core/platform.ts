// ---------------------------------------------------------------------------
// Where are we running? The answer decides which SQL driver is used and which
// sync providers make sense.
//
//   web    - a normal browser page: SQLite wasm in a worker, persisted to OPFS.
//   tinyjs - inside the tinyjs.app webview: SQL runs in the tinyjs backend
//            (tjs:sqlite) over `tiny.api.call`, persisted to the app data dir.
//   puter  - hosted on Puter (or opted in): same wasm driver as `web`, plus the
//            Puter filesystem as the sync target.
// ---------------------------------------------------------------------------

export type PlatformKind = 'web' | 'tinyjs' | 'puter'

const PUTER_FLAG = 'cocktail.platform.puter'

export function detectPlatform(): PlatformKind {
  if (typeof window === 'undefined') return 'web'
  if (window.tiny?.api) return 'tinyjs'
  const host = window.location.hostname
  if (host.endsWith('.puter.site') || host.endsWith('puter.com')) return 'puter'
  if (window.location.search.includes('platform=puter')) return 'puter'
  try {
    if (window.localStorage.getItem(PUTER_FLAG) === '1') return 'puter'
  } catch {
    /* storage may be blocked */
  }
  return 'web'
}

export function setPuterOptIn(on: boolean) {
  try {
    if (on) window.localStorage.setItem(PUTER_FLAG, '1')
    else window.localStorage.removeItem(PUTER_FLAG)
  } catch {
    /* ignore */
  }
}

let puterLoading: Promise<PuterSdk> | null = null

/** Loads the Puter SDK script on demand and resolves with `window.puter`. */
export function loadPuter(): Promise<PuterSdk> {
  if (window.puter) return Promise.resolve(window.puter)
  if (puterLoading) return puterLoading
  puterLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://js.puter.com/v2/'
    s.async = true
    s.onload = () => (window.puter ? resolve(window.puter) : reject(new Error('Puter SDK did not load')))
    s.onerror = () => reject(new Error('Could not load the Puter SDK'))
    document.head.appendChild(s)
  })
  return puterLoading
}

export const platform: PlatformKind = detectPlatform()
