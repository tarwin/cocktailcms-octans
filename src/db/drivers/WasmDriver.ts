import { normaliseParams, type RunResult, type SqlDriver, type SqlParams, type SqlStatement } from '../driver'

interface Pending {
  resolve: (v: any) => void
  reject: (e: Error) => void
}

/**
 * Main-thread proxy for the SQLite wasm worker. All calls are serialised
 * through a single worker so statements run in order.
 */
export class WasmDriver implements SqlDriver {
  persistent = false
  version = ''
  mode: 'opfs' | 'idb' | 'memory' = 'memory'
  poolError = ''

  get name() {
    const where = this.mode === 'opfs' ? 'browser file system' : this.mode === 'idb' ? 'IndexedDB mirror' : 'memory only'
    return `SQLite ${this.version} (WebAssembly, ${where})`
  }

  private worker: Worker | null = null
  private nextId = 1
  private pending = new Map<number, Pending>()

  async init() {
    this.worker = new Worker(new URL('./wasm.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (ev: MessageEvent) => {
      const { id, ok, result, error } = ev.data
      const p = this.pending.get(id)
      if (!p) return
      this.pending.delete(id)
      ok ? p.resolve(result) : p.reject(new Error(error))
    }
    this.worker.onerror = (ev) => {
      console.error('[sqlite worker]', ev.message)
    }
    const info = await this.send<{ persistent: boolean; version: string; mode: 'opfs' | 'idb' | 'memory'; poolError?: string }>({ type: 'init' })
    this.persistent = info.persistent
    this.version = info.version
    this.mode = info.mode
    this.poolError = info.poolError || ''
    // Release the OPFS lock (and flush the IndexedDB mirror) as soon as the
    // page goes away, so the next page load can take it over immediately.
    window.addEventListener('pagehide', () => void this.close())
  }

  private send<T>(msg: Record<string, any>, transfer?: Transferable[]): Promise<T> {
    if (!this.worker) return Promise.reject(new Error('Database not initialised'))
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker!.postMessage({ id, ...msg }, transfer || [])
    })
  }

  query<T = Record<string, any>>(sql: string, params?: SqlParams) {
    return this.send<T[]>({ type: 'query', sql, params: normaliseParams(params) })
  }

  run(sql: string, params?: SqlParams) {
    return this.send<RunResult>({ type: 'run', sql, params: normaliseParams(params) })
  }

  exec(sql: string) {
    return this.send<void>({ type: 'exec', sql })
  }

  batch(statements: SqlStatement[]) {
    return this.send<void>({
      type: 'batch',
      statements: statements.map((s) => ({ sql: s.sql, params: normaliseParams(s.params) })),
    })
  }

  flush() {
    return this.send<void>({ type: 'flush' }).catch(() => {})
  }

  exportDb() {
    return this.send<Uint8Array>({ type: 'export' })
  }

  importDb(bytes: Uint8Array) {
    // copy so the caller keeps its buffer
    const copy = new Uint8Array(bytes)
    return this.send<void>({ type: 'import', bytes: copy }, [copy.buffer])
  }

  async close() {
    await this.send<void>({ type: 'close' })
    this.worker?.terminate()
    this.worker = null
  }
}
