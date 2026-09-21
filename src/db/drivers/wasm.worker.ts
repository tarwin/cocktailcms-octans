/// <reference lib="webworker" />
// ---------------------------------------------------------------------------
// SQLite wasm worker. Owns the one database connection; the main thread talks
// to it through a tiny request/response protocol (see WasmDriver.ts).
//
// Persistence, in order of preference:
//   1. OPFS via the "SAH pool" VFS - real file-backed SQLite, no COOP/COEP
//      headers needed. The pool takes an exclusive lock, so a second tab (or a
//      worker that has not been torn down yet) cannot get it.
//   2. In-memory database mirrored to IndexedDB after every write. Slower on
//      write, but nothing is lost if (1) is unavailable.
//   3. Plain memory, if even IndexedDB is blocked (reported as not persistent).
// ---------------------------------------------------------------------------
import sqlite3InitModule, { type Database, type Sqlite3Static, type SAHPoolUtil } from '@sqlite.org/sqlite-wasm'

const DB_NAME = '/cocktailcms.sqlite3'
const POOL_DIR = '/cocktailcms-opfs'
const IDB_NAME = 'cocktailcms'
const IDB_STORE = 'images'
const IDB_KEY = 'database'

type Mode = 'opfs' | 'idb' | 'memory'

let sqlite3: Sqlite3Static
let db: Database
let pool: SAHPoolUtil | null = null
let mode: Mode = 'memory'
let saveTimer: ReturnType<typeof setTimeout> | null = null
let saving: Promise<void> | null = null
let poolError = ''

type Req =
  | { id: number; type: 'init' }
  | { id: number; type: 'query'; sql: string; params?: any }
  | { id: number; type: 'run'; sql: string; params?: any }
  | { id: number; type: 'exec'; sql: string }
  | { id: number; type: 'batch'; statements: Array<{ sql: string; params?: any }> }
  | { id: number; type: 'export' }
  | { id: number; type: 'import'; bytes: Uint8Array }
  | { id: number; type: 'flush' }
  | { id: number; type: 'close' }

// ------------------------------------------------------------- IndexedDB
function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(): Promise<Uint8Array | null> {
  try {
    const d = await idbOpen()
    return await new Promise((resolve, reject) => {
      const tx = d.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
      req.onsuccess = () => resolve(req.result ? new Uint8Array(req.result) : null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

async function idbPut(bytes: Uint8Array | null): Promise<void> {
  const d = await idbOpen()
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(IDB_STORE, 'readwrite')
    const store = tx.objectStore(IDB_STORE)
    if (bytes) store.put(bytes.buffer, IDB_KEY)
    else store.delete(IDB_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ----------------------------------------------------------------- sqlite
function openMemoryDb(image?: Uint8Array | null) {
  if (image && image.length) {
    const tmp = `/image-${Date.now()}.sqlite3`
    sqlite3.capi.sqlite3_js_posix_create_file(tmp, image)
    db = new sqlite3.oo1.DB(tmp, 'c')
  } else {
    db = new sqlite3.oo1.DB(':memory:', 'c')
  }
  db.exec('PRAGMA foreign_keys = ON;')
}

function openDb() {
  if (pool) {
    db = new pool.OpfsSAHPoolDb(DB_NAME)
    db.exec('PRAGMA foreign_keys = ON;')
  } else {
    openMemoryDb()
  }
}

async function tryInstallPool(): Promise<SAHPoolUtil | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await sqlite3.installOpfsSAHPoolVfs({ directory: POOL_DIR, initialCapacity: 6 })
    } catch (e) {
      poolError = (e as Error)?.message || String(e)
      console.warn(`[sqlite] OPFS pool unavailable (attempt ${attempt + 1})`, poolError)
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)))
    }
  }
  return null
}

function hasUserData(): boolean {
  try {
    const n = db.selectValue(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'blueprints'`)
    if (!n) return false
    return Number(db.selectValue(`SELECT COUNT(*) FROM blueprints`)) > 0
  } catch {
    return false
  }
}

async function init() {
  sqlite3 = await sqlite3InitModule()
  pool = await tryInstallPool()
  if (pool) {
    mode = 'opfs'
    openDb()
    // A previous session may have run in the IndexedDB fallback; adopt its
    // data if the real database is still empty.
    const image = await idbGet()
    if (image && !hasUserData()) {
      db.close()
      await pool.importDb(DB_NAME, image)
      openDb()
    }
    if (image) idbPut(null).catch(() => {})
  } else {
    const image = await idbGet()
    try {
      await idbPut(image) // probe that IndexedDB is writable
      mode = 'idb'
    } catch {
      mode = 'memory'
    }
    openMemoryDb(image)
  }
  return { mode, persistent: mode !== 'memory', version: sqlite3.version.libVersion, poolError }
}

function exportBytes(): Uint8Array {
  return sqlite3.capi.sqlite3_js_db_export(db.pointer!)
}

/** In IndexedDB mode, mirror the database image after writes (debounced). */
function scheduleSave() {
  if (mode !== 'idb') return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void flush(), 800)
}

async function flush() {
  if (mode !== 'idb') return
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (saving) await saving
  saving = idbPut(exportBytes()).catch((e) => console.error('[sqlite] IndexedDB save failed', e))
  await saving
  saving = null
}

async function importBytes(bytes: Uint8Array) {
  db.close()
  if (pool) {
    await pool.importDb(DB_NAME, bytes)
    openDb()
  } else {
    openMemoryDb(bytes)
    scheduleSave()
  }
}

self.onmessage = async (ev: MessageEvent<Req>) => {
  const msg = ev.data
  const reply = (result: any, transfer?: Transferable[]) => (self as any).postMessage({ id: msg.id, ok: true, result }, transfer || [])
  try {
    switch (msg.type) {
      case 'init':
        reply(await init())
        break
      case 'query':
        reply(db.selectObjects(msg.sql, msg.params))
        break
      case 'run':
        db.exec({ sql: msg.sql, bind: msg.params })
        scheduleSave()
        reply({
          changes: sqlite3.capi.sqlite3_changes(db.pointer!),
          lastId: Number(sqlite3.capi.sqlite3_last_insert_rowid(db.pointer!)),
        })
        break
      case 'exec':
        db.exec(msg.sql)
        scheduleSave()
        reply(null)
        break
      case 'batch':
        db.exec('BEGIN')
        try {
          for (const s of msg.statements) db.exec({ sql: s.sql, bind: s.params })
          db.exec('COMMIT')
        } catch (e) {
          try {
            db.exec('ROLLBACK')
          } catch {
            /* ignore */
          }
          throw e
        }
        scheduleSave()
        reply(null)
        break
      case 'export': {
        const bytes = exportBytes()
        reply(bytes, [bytes.buffer])
        break
      }
      case 'import':
        await importBytes(msg.bytes)
        reply(null)
        break
      case 'flush':
        await flush()
        reply(null)
        break
      case 'close':
        await flush()
        db.close()
        reply(null)
        break
    }
  } catch (e: any) {
    ;(self as any).postMessage({ id: msg.id, ok: false, error: e?.message || String(e) })
  }
}
