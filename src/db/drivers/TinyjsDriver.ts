import { base64ToBytes, bytesToBase64 } from '@/core/utils'
import { normaliseParams, type RunResult, type SqlDriver, type SqlParams, type SqlStatement } from '../driver'

/**
 * Forwards SQL to the tinyjs backend (see `tinyjs/backend/main.ts`), which
 * runs it with the native `tjs:sqlite` module. The bridge is JSON, so BLOBs
 * travel as `{ __blob: base64 }` in both directions.
 */
export class TinyjsDriver implements SqlDriver {
  readonly name = 'SQLite (native, tinyjs backend)'
  readonly persistent = true

  private get tiny() {
    const t = window.tiny
    if (!t) throw new Error('tinyjs bridge not available')
    return t
  }

  private encodeParams(params?: SqlParams): any {
    const p = normaliseParams(params)
    if (!p) return undefined
    const enc = (v: any) => (v instanceof Uint8Array ? { __blob: bytesToBase64(v) } : v)
    if (Array.isArray(p)) return p.map(enc)
    return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, enc(v)]))
  }

  private decodeRows(rows: any[]): any[] {
    for (const row of rows) {
      for (const k of Object.keys(row)) {
        const v = row[k]
        if (v && typeof v === 'object' && typeof v.__blob === 'string') row[k] = base64ToBytes(v.__blob)
      }
    }
    return rows
  }

  async init() {
    await this.tiny.api.call('dbInit')
  }

  async query<T = Record<string, any>>(sql: string, params?: SqlParams) {
    const rows = await this.tiny.api.call<any[]>('dbQuery', { sql, params: this.encodeParams(params) })
    return this.decodeRows(rows) as T[]
  }

  run(sql: string, params?: SqlParams) {
    return this.tiny.api.call<RunResult>('dbRun', { sql, params: this.encodeParams(params) })
  }

  async exec(sql: string) {
    await this.tiny.api.call('dbExec', { sql })
  }

  async batch(statements: SqlStatement[]) {
    await this.tiny.api.call('dbBatch', {
      statements: statements.map((s) => ({ sql: s.sql, params: this.encodeParams(s.params) })),
    })
  }

  async exportDb() {
    const b64 = await this.tiny.api.call<string>('dbExport')
    return base64ToBytes(b64)
  }

  async importDb(bytes: Uint8Array) {
    await this.tiny.api.call('dbImport', { data: bytesToBase64(bytes) })
  }

  async close() {
    await this.tiny.api.call('dbClose')
  }
}
