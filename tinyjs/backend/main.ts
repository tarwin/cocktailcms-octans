// ---------------------------------------------------------------------------
// tinyjs.app backend for Cocktail CMS.
//
// The frontend never touches the file system itself; it sends SQL over
// `tiny.api.call(...)` and this module runs it with the runtime's native
// SQLite (`tjs:sqlite`). The database file lives in the per-app data dir.
//
// SQLite here is synchronous; file-system calls (`tjs.*`) are async.
// BLOBs cross the JSON bridge as `{ __blob: base64 }`.
// ---------------------------------------------------------------------------
// @ts-nocheck — the tjs:* modules only exist inside the tinyjs runtime.
import { Database } from 'tjs:sqlite'

const DB_FILE = 'cocktailcms.sqlite3'

let db: any = null
let dbPath = ''

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)))
  }
  return btoa(bin)
}

function decodeParams(params: any) {
  if (!params) return []
  const dec = (v: any) => (v && typeof v === 'object' && typeof v.__blob === 'string' ? fromBase64(v.__blob) : v)
  if (Array.isArray(params)) return params.map(dec)
  return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, dec(v)]))
}

function encodeRows(rows: any[]) {
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      const v = row[k]
      if (v instanceof Uint8Array || v instanceof ArrayBuffer) {
        row[k] = { __blob: toBase64(v instanceof Uint8Array ? v : new Uint8Array(v)) }
      }
    }
  }
  return rows
}

function runStatement(sql: string, params: any) {
  const st = db.prepare(sql)
  try {
    const p = decodeParams(params)
    Array.isArray(p) ? st.run(...p) : st.run(p)
  } finally {
    st.finalize()
  }
}

async function ensureOpen(app: any) {
  if (db) return
  const dir = app?.paths?.data || `${globalThis.tjs?.homeDir || '.'}/.cocktailcms`
  await tjs.makeDir(dir, { recursive: true })
  dbPath = `${dir}/${DB_FILE}`
  db = new Database(dbPath)
  db.exec('PRAGMA foreign_keys = ON;')
}

export const api = {
  dbInit: async (_params: any, app: any) => {
    await ensureOpen(app)
    return { path: dbPath }
  },

  dbQuery: async ({ sql, params }: any, app: any) => {
    await ensureOpen(app)
    const st = db.prepare(sql)
    try {
      const p = decodeParams(params)
      const rows = Array.isArray(p) ? st.all(...p) : st.all(p)
      return encodeRows(rows || [])
    } finally {
      st.finalize()
    }
  },

  dbRun: async ({ sql, params }: any, app: any) => {
    await ensureOpen(app)
    runStatement(sql, params)
    const row = db.prepare('SELECT changes() AS changes, last_insert_rowid() AS lastId').all()[0]
    return { changes: row?.changes ?? 0, lastId: row?.lastId ?? 0 }
  },

  dbExec: async ({ sql }: any, app: any) => {
    await ensureOpen(app)
    db.exec(sql)
    return null
  },

  dbBatch: async ({ statements }: any, app: any) => {
    await ensureOpen(app)
    db.exec('BEGIN')
    try {
      for (const s of statements) runStatement(s.sql, s.params)
      db.exec('COMMIT')
    } catch (e) {
      try {
        db.exec('ROLLBACK')
      } catch {}
      throw e
    }
    return null
  },

  dbExport: async (_params: any, app: any) => {
    await ensureOpen(app)
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    const bytes = await tjs.readFile(dbPath)
    return toBase64(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
  },

  dbImport: async ({ data }: any, app: any) => {
    await ensureOpen(app)
    db.close()
    db = null
    await tjs.writeFile(dbPath, fromBase64(data))
    await ensureOpen(app)
    return null
  },

  dbClose: async () => {
    if (db) {
      db.close()
      db = null
    }
    return null
  },
}

export function init(_app: any) {
  // nothing to do until the frontend asks for the database
}
