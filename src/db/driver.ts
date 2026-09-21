// ---------------------------------------------------------------------------
// The one storage abstraction the rest of the app talks to. Every platform
// provides an implementation:
//
//   WasmDriver   - SQLite compiled to WebAssembly, running in a Web Worker,
//                  persisted to the Origin Private File System (browser).
//   TinyjsDriver - forwards SQL to the tinyjs backend, which uses the native
//                  `tjs:sqlite` module (desktop app).
//
// Parameters may include Uint8Array values, which bind as BLOBs. BLOB columns
// come back as Uint8Array.
// ---------------------------------------------------------------------------

export type SqlParam = string | number | boolean | null | undefined | Uint8Array
export type SqlParams = SqlParam[] | Record<string, SqlParam>
export type Row = Record<string, any>

export interface SqlStatement {
  sql: string
  params?: SqlParams
}

export interface RunResult {
  changes: number
  lastId: number
}

export interface SqlDriver {
  /** Human readable name for the settings page. */
  readonly name: string
  /** Whether data survives a reload (OPFS / native file) or is memory only. */
  readonly persistent: boolean
  init(): Promise<void>
  query<T = Row>(sql: string, params?: SqlParams): Promise<T[]>
  run(sql: string, params?: SqlParams): Promise<RunResult>
  /** Runs every statement inside one transaction. */
  batch(statements: SqlStatement[]): Promise<void>
  /** Runs several SQL statements (no params) in one go, e.g. DDL. */
  exec(sql: string): Promise<void>
  /** The whole database as a SQLite file image. */
  exportDb(): Promise<Uint8Array>
  /** Replaces the whole database with the given SQLite file image. */
  importDb(bytes: Uint8Array): Promise<void>
  /** Makes sure pending writes reached durable storage (no-op for most drivers). */
  flush?(): Promise<void>
  close(): Promise<void>
}

export function normaliseParams(params?: SqlParams): SqlParams | undefined {
  if (!params) return undefined
  const fix = (v: SqlParam) => {
    if (v === undefined) return null
    if (typeof v === 'boolean') return v ? 1 : 0
    return v
  }
  if (Array.isArray(params)) return params.map(fix)
  const out: Record<string, SqlParam> = {}
  for (const [k, v] of Object.entries(params)) out[k] = fix(v)
  return out
}
