import { EventBus } from '@/core/bus'
import type {
  Blueprint,
  BlueprintSummary,
  DataRecord,
  Field,
  FileMeta,
  FilesExport,
  Project,
  ProjectExport,
  ProjectSettings,
} from '@/core/types'
import {
  ALLOWED_IMAGE_MIME_TYPES,
  bytesToDataUrl,
  dataUrlToBytes,
  deepCopy,
  getImageSize,
  normaliseField,
  orderBy,
  readFileAsBytes,
  resizeImageToBytes,
  safeJson,
} from '@/core/utils'
import type { SqlDriver, SqlStatement } from '@/db'
import { buildViewsSql, jsonPath } from './views'

const DEFAULT_SETTINGS: ProjectSettings = {
  highlightColor: '#737A90',
  highlightTextColor: '#FFFFFF',
  name: '',
  icon: '',
  homeText: '',
  pallete: [],
}

const CURRENT_PROJECT_KEY = 'current_project_id'

interface BlueprintRow {
  id: number
  key: string
  label: string
  ord: number
  hidden: number
  secondary: number
  next_record_id: number
  config: string
}

interface FieldRow {
  blueprint_id: number
  id: number
  key: string
  label: string
  type: string
  ord: number
  required: number
  hide_in_list: number
  help: string
  params: string
}

/**
 * The application data API. Everything the UI needs goes through here; the
 * only thing underneath is a `SqlDriver`.
 *
 * Emits on `bus`:
 *   - `changed` (kind)      after any write, for sync/dirty tracking
 *   - `schemasUpdated`, `settingsUpdated`, `projectsUpdated`, `projectSwitched`
 */
export class Api {
  readonly bus = new EventBus()
  private projectId = 1
  private viewsDirty = true

  constructor(public readonly db: SqlDriver) {}

  // ------------------------------------------------------------ lifecycle
  async init() {
    const row = await this.db.query<{ value: string }>(`SELECT value FROM app_settings WHERE key = ?`, [CURRENT_PROJECT_KEY])
    const wanted = parseInt(row[0]?.value || '1', 10) || 1
    const exists = await this.db.query<{ id: number }>(`SELECT id FROM projects WHERE id = ?`, [wanted])
    if (exists.length) {
      this.projectId = wanted
    } else {
      const first = await this.db.query<{ id: number }>(`SELECT id FROM projects ORDER BY ord, id LIMIT 1`)
      this.projectId = first[0]?.id || 1
    }
  }

  get currentProjectId() {
    return this.projectId
  }

  private changed(kind: string) {
    if (kind === 'schema' || kind === 'project') this.viewsDirty = true
    this.bus.emit('changed', kind)
  }

  // ------------------------------------------------------------- projects
  async getProjectsList(): Promise<Project[]> {
    const rows = await this.db.query<{ id: number; key: string; label: string; ord: number }>(
      `SELECT id, key, label, ord FROM projects ORDER BY ord, id`,
    )
    return rows.map((r) => ({ id: r.id, key: r.key, label: r.label, order: r.ord }))
  }

  async getCurrentProject(): Promise<Project> {
    const list = await this.getProjectsList()
    return list.find((p) => p.id === this.projectId) || list[0]
  }

  async switchProject(projectId: number) {
    const rows = await this.db.query<{ id: number }>(`SELECT id FROM projects WHERE id = ?`, [projectId])
    if (!rows.length) throw new Error(`No project with ID "${projectId}"`)
    this.projectId = projectId
    this.viewsDirty = true
    await this.db.run(`INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`, [CURRENT_PROJECT_KEY, String(projectId)])
    this.bus.emit('projectSwitched', projectId)
  }

  async addProject(project: { key: string; label: string; order?: number }): Promise<Project> {
    const res = await this.db.run(`INSERT INTO projects (key, label, ord) VALUES (?, ?, ?)`, [
      project.key,
      project.label,
      project.order ?? 0,
    ])
    this.changed('project')
    this.bus.emit('projectsUpdated')
    return { id: res.lastId, key: project.key, label: project.label, order: project.order ?? 0 }
  }

  async updateProject(project: Project): Promise<Project> {
    await this.db.run(`UPDATE projects SET key = ?, label = ?, ord = ? WHERE id = ?`, [
      project.key,
      project.label,
      project.order ?? 0,
      project.id,
    ])
    this.changed('project')
    this.bus.emit('projectsUpdated')
    return deepCopy(project)
  }

  async removeProject(projectId: number) {
    const list = await this.getProjectsList()
    if (list.length < 2) throw new Error('Cannot remove project. There is only one.')
    if (projectId === this.projectId) throw new Error('Cannot remove the current project. Switch to another first.')
    await this.db.batch([
      { sql: `DELETE FROM records WHERE project_id = ?`, params: [projectId] },
      { sql: `DELETE FROM fields WHERE project_id = ?`, params: [projectId] },
      { sql: `DELETE FROM blueprints WHERE project_id = ?`, params: [projectId] },
      { sql: `DELETE FROM files WHERE project_id = ?`, params: [projectId] },
      { sql: `DELETE FROM settings WHERE project_id = ?`, params: [projectId] },
      { sql: `DELETE FROM projects WHERE id = ?`, params: [projectId] },
    ])
    this.changed('project')
    this.bus.emit('projectsUpdated')
  }

  // ----------------------------------------------------------- blueprints
  private rowToBlueprint(row: BlueprintRow, fields: FieldRow[]): Blueprint {
    const config = safeJson<Record<string, any>>(row.config, {}) || {}
    return {
      ...config,
      id: row.id,
      key: row.key,
      label: row.label,
      order: row.ord,
      hidden: !!row.hidden,
      secondary: !!row.secondary,
      nextRecordId: row.next_record_id,
      fields: orderBy(
        fields
          .filter((f) => f.blueprint_id === row.id)
          .map((f) => ({
            id: f.id,
            key: f.key,
            label: f.label,
            type: f.type as Field['type'],
            order: f.ord,
            required: !!f.required,
            hideInList: !!f.hide_in_list,
            help: f.help || '',
            params: safeJson<Record<string, any>>(f.params, {}) || {},
          })),
        'order',
      ),
    }
  }

  private blueprintConfig(schema: Partial<Blueprint>): string {
    const {
      id: _id,
      key: _k,
      label: _l,
      fields: _f,
      order: _o,
      hidden: _h,
      secondary: _s,
      nextRecordId: _n,
      ...config
    } = schema as any
    return JSON.stringify(config || {})
  }

  async getSchemas(): Promise<Blueprint[]> {
    const [rows, fields] = await Promise.all([
      this.db.query<BlueprintRow>(`SELECT * FROM blueprints WHERE project_id = ? ORDER BY ord, id`, [this.projectId]),
      this.db.query<FieldRow>(`SELECT * FROM fields WHERE project_id = ? ORDER BY ord, id`, [this.projectId]),
    ])
    return rows.map((r) => this.rowToBlueprint(r, fields))
  }

  async getSchemaList(): Promise<BlueprintSummary[]> {
    const rows = await this.db.query<BlueprintRow>(
      `SELECT id, key, label, hidden, secondary FROM blueprints WHERE project_id = ? ORDER BY ord, id`,
      [this.projectId],
    )
    return rows.map((r) => ({ id: r.id, key: r.key, label: r.label, hidden: !!r.hidden, secondary: !!r.secondary }))
  }

  async getSchema(schemaId: number): Promise<Blueprint | null> {
    const rows = await this.db.query<BlueprintRow>(`SELECT * FROM blueprints WHERE project_id = ? AND id = ?`, [
      this.projectId,
      schemaId,
    ])
    if (!rows.length) return null
    const fields = await this.db.query<FieldRow>(
      `SELECT * FROM fields WHERE project_id = ? AND blueprint_id = ? ORDER BY ord, id`,
      [this.projectId, schemaId],
    )
    return this.rowToBlueprint(rows[0], fields)
  }

  async createSchema(key: string, label: string): Promise<Blueprint> {
    const next = await this.db.query<{ n: number }>(
      `SELECT COALESCE(MAX(id), 0) + 1 AS n FROM blueprints WHERE project_id = ?`,
      [this.projectId],
    )
    const id = next[0].n
    const schema: Blueprint = {
      id,
      key,
      label,
      fields: [],
      order: 0,
      nextRecordId: 1,
      hidden: false,
      secondary: false,
      defaultSorting: null,
      defaultSortingOrder: 'asc',
    }
    await this.db.run(
      `INSERT INTO blueprints (project_id, id, key, label, ord, hidden, secondary, next_record_id, config) VALUES (?, ?, ?, ?, 0, 0, 0, 1, ?)`,
      [this.projectId, id, key, label, this.blueprintConfig(schema)],
    )
    this.changed('schema')
    this.bus.emit('schemasUpdated')
    return schema
  }

  private fieldStatements(schemaId: number, fields: Field[]): SqlStatement[] {
    return fields.map((f) => ({
      sql: `INSERT OR REPLACE INTO fields (project_id, blueprint_id, id, key, label, type, ord, required, hide_in_list, help, params) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        this.projectId,
        schemaId,
        f.id,
        f.key,
        f.label,
        f.type,
        f.order,
        f.required ? 1 : 0,
        f.hideInList ? 1 : 0,
        f.help || '',
        JSON.stringify(f.params || {}),
      ],
    }))
  }

  /** Replaces a blueprint (and its fields). Renamed field keys are moved in the record data. */
  async setSchema(schema: Blueprint) {
    const existing = await this.getSchema(schema.id)
    if (!existing) throw new Error('No blueprint to update')

    const fields = orderBy(schema.fields, 'order').map((f, i) => ({ ...f, order: i + 1 }))
    const stmts: SqlStatement[] = []

    // renamed keys
    for (const old of existing.fields) {
      const now = fields.find((f) => f.id === old.id)
      if (now && now.key !== old.key) {
        stmts.push({
          sql: `UPDATE records SET data = json_set(json_remove(data, ${jsonPath(old.key)}), ${jsonPath(now.key)}, json_extract(data, ${jsonPath(old.key)})) WHERE project_id = ? AND blueprint_id = ? AND json_type(data, ${jsonPath(old.key)}) IS NOT NULL`,
          params: [this.projectId, schema.id],
        })
      }
    }

    stmts.push({
      sql: `UPDATE blueprints SET key = ?, label = ?, ord = ?, hidden = ?, secondary = ?, next_record_id = ?, config = ? WHERE project_id = ? AND id = ?`,
      params: [
        schema.key,
        schema.label,
        schema.order ?? 0,
        schema.hidden ? 1 : 0,
        schema.secondary ? 1 : 0,
        schema.nextRecordId ?? existing.nextRecordId ?? 1,
        this.blueprintConfig(schema),
        this.projectId,
        schema.id,
      ],
    })

    const keepIds = fields.map((f) => f.id)
    for (const old of existing.fields) {
      if (!keepIds.includes(old.id)) {
        stmts.push({
          sql: `DELETE FROM fields WHERE project_id = ? AND blueprint_id = ? AND id = ?`,
          params: [this.projectId, schema.id, old.id],
        })
      }
    }
    stmts.push(...this.fieldStatements(schema.id, fields))

    await this.db.batch(stmts)
    this.changed('schema')
    this.bus.emit('schemasUpdated')
  }

  async deleteSchema(schemaId: number) {
    await this.db.batch([
      { sql: `DELETE FROM records WHERE project_id = ? AND blueprint_id = ?`, params: [this.projectId, schemaId] },
      { sql: `DELETE FROM fields WHERE project_id = ? AND blueprint_id = ?`, params: [this.projectId, schemaId] },
      { sql: `DELETE FROM blueprints WHERE project_id = ? AND id = ?`, params: [this.projectId, schemaId] },
    ])
    this.changed('schema')
    this.bus.emit('schemasUpdated')
  }

  async removeField(schemaId: number, fieldId: number) {
    const schema = await this.getSchema(schemaId)
    const field = schema?.fields.find((f) => f.id === fieldId)
    if (!schema || !field) throw new Error('No field')
    await this.db.batch([
      {
        sql: `UPDATE records SET data = json_remove(data, ${jsonPath(field.key)}) WHERE project_id = ? AND blueprint_id = ?`,
        params: [this.projectId, schemaId],
      },
      { sql: `DELETE FROM fields WHERE project_id = ? AND blueprint_id = ? AND id = ?`, params: [this.projectId, schemaId, fieldId] },
    ])
    this.changed('schema')
    this.bus.emit('schemasUpdated')
  }

  // -------------------------------------------------------------- records
  private rowToRecord(row: { id: number; data: string }): DataRecord {
    return { ...(safeJson<Record<string, any>>(row.data, {}) || {}), id: row.id }
  }

  private static pick(row: DataRecord, fields?: string[] | null): DataRecord {
    if (!fields) return row
    const out: DataRecord = { id: row.id }
    for (const k of fields) if (k in row) out[k] = row[k]
    return out
  }

  async getAllData(): Promise<Array<{ schemaId: number; data: DataRecord[] }>> {
    const rows = await this.db.query<{ blueprint_id: number; id: number; data: string }>(
      `SELECT blueprint_id, id, data FROM records WHERE project_id = ? ORDER BY blueprint_id, id`,
      [this.projectId],
    )
    const byId = new Map<number, DataRecord[]>()
    for (const r of rows) {
      if (!byId.has(r.blueprint_id)) byId.set(r.blueprint_id, [])
      byId.get(r.blueprint_id)!.push(this.rowToRecord(r))
    }
    const schemas = await this.getSchemaList()
    return schemas.map((s) => ({ schemaId: s.id, data: byId.get(s.id) || [] }))
  }

  async getData(schemaId: number, fields?: string[] | null, filter?: Record<string, any> | null): Promise<DataRecord[]> {
    let sql = `SELECT id, data FROM records WHERE project_id = ? AND blueprint_id = ?`
    const params: any[] = [this.projectId, schemaId]
    if (filter) {
      for (const [k, v] of Object.entries(filter)) {
        sql += ` AND json_extract(data, ${jsonPath(k)}) = ?`
        params.push(typeof v === 'boolean' ? (v ? 1 : 0) : v)
      }
    }
    sql += ` ORDER BY id`
    const rows = await this.db.query<{ id: number; data: string }>(sql, params)
    return rows.map((r) => Api.pick(this.rowToRecord(r), fields && fields.length ? [...new Set([...fields, 'id'])] : null))
  }

  async getDataCount(schemaId: number, _fields?: string[] | null, filter?: Record<string, any> | null): Promise<number> {
    let sql = `SELECT COUNT(*) AS n FROM records WHERE project_id = ? AND blueprint_id = ?`
    const params: any[] = [this.projectId, schemaId]
    if (filter) {
      for (const [k, v] of Object.entries(filter)) {
        sql += ` AND json_extract(data, ${jsonPath(k)}) = ?`
        params.push(typeof v === 'boolean' ? (v ? 1 : 0) : v)
      }
    }
    const rows = await this.db.query<{ n: number }>(sql, params)
    return rows[0]?.n || 0
  }

  async getRecord(schemaId: number, recordId: number): Promise<DataRecord> {
    const rows = await this.db.query<{ id: number; data: string }>(
      `SELECT id, data FROM records WHERE project_id = ? AND blueprint_id = ? AND id = ?`,
      [this.projectId, schemaId, recordId],
    )
    if (!rows.length) throw new Error('No record for ID')
    return this.rowToRecord(rows[0])
  }

  private async nextRecordId(schemaId: number): Promise<number> {
    const rows = await this.db.query<{ n: number }>(
      `SELECT MAX(b.next_record_id, COALESCE((SELECT MAX(r.id) + 1 FROM records r WHERE r.project_id = b.project_id AND r.blueprint_id = b.id), 1)) AS n FROM blueprints b WHERE b.project_id = ? AND b.id = ?`,
      [this.projectId, schemaId],
    )
    if (!rows.length) throw new Error('No blueprint')
    return rows[0].n
  }

  async addData(schemaId: number, data: Record<string, any>): Promise<DataRecord> {
    const id = await this.nextRecordId(schemaId)
    const { id: _ignored, ...values } = data
    await this.db.batch([
      {
        sql: `INSERT INTO records (project_id, blueprint_id, id, data) VALUES (?, ?, ?, ?)`,
        params: [this.projectId, schemaId, id, JSON.stringify(values)],
      },
      {
        sql: `UPDATE blueprints SET next_record_id = ? WHERE project_id = ? AND id = ?`,
        params: [id + 1, this.projectId, schemaId],
      },
    ])
    this.changed('data')
    return { ...deepCopy(values), id }
  }

  async updateData(schemaId: number, data: DataRecord) {
    if (!data.id) throw new Error('No ID')
    const { id, ...values } = data
    const res = await this.db.run(
      `UPDATE records SET data = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE project_id = ? AND blueprint_id = ? AND id = ?`,
      [JSON.stringify(values), this.projectId, schemaId, id],
    )
    if (!res.changes) throw new Error('No record to update')
    this.changed('data')
  }

  /**
   * Deletes a record, removes its sub-records, and fixes every link that
   * pointed at it — either clearing the link or pointing it at `replaceWithId`.
   */
  async deleteData(schemaId: number, recordId: number, replaceWithId?: number | null) {
    const schemas = await this.getSchemas()
    const schema = schemas.find((s) => s.id === schemaId)
    if (!schema) throw new Error('No blueprint')

    const stmts: SqlStatement[] = [
      { sql: `DELETE FROM records WHERE project_id = ? AND blueprint_id = ? AND id = ?`, params: [this.projectId, schemaId, recordId] },
    ]

    // sub records hang off this one
    for (const field of schema.fields) {
      if (field.type === 'sub' && field.params?.linkId && field.params?.linkFieldId) {
        stmts.push({
          sql: `DELETE FROM records WHERE project_id = ? AND blueprint_id = ? AND json_extract(data, ${jsonPath(field.params.linkFieldId)}) = ?`,
          params: [this.projectId, Number(field.params.linkId), recordId],
        })
      }
    }

    // links from other blueprints to this record
    for (const other of schemas) {
      const linkFields = other.fields.filter((f) => f.type === 'link' && Number(f.params?.linkId) === schemaId)
      if (!linkFields.length) continue
      const rows = await this.getData(other.id)
      for (const row of rows) {
        let touched = false
        for (const f of linkFields) {
          const v = row[f.key]
          if (Array.isArray(v)) {
            const idx = v.indexOf(recordId)
            if (idx > -1) {
              if (replaceWithId) {
                if (!v.includes(replaceWithId)) v.splice(idx, 1, replaceWithId)
                else v.splice(idx, 1)
              } else {
                v.splice(idx, 1)
              }
              touched = true
            }
          } else if (v === recordId) {
            row[f.key] = replaceWithId || null
            touched = true
          }
        }
        if (touched) {
          const { id, ...values } = row
          stmts.push({
            sql: `UPDATE records SET data = ? WHERE project_id = ? AND blueprint_id = ? AND id = ?`,
            params: [JSON.stringify(values), this.projectId, other.id, id],
          })
        }
      }
    }

    await this.db.batch(stmts)
    this.changed('data')
  }

  async getRecordIdByFieldValue(schemaId: number, fieldId: number, value: any, fuzzy: boolean): Promise<number> {
    const schema = await this.getSchema(schemaId)
    const field = schema?.fields.find((f) => f.id === fieldId)
    if (!schema || !field) throw new Error('No field')
    const rows = await this.getData(schemaId, [field.key])
    const norm = (v: any) =>
      String(v ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
    const found = fuzzy ? rows.find((r) => norm(r[field.key]) === norm(value)) : rows.find((r) => r[field.key] === value)
    return found?.id ?? -1
  }

  // ------------------------------------------------------------- settings
  async getSettings(): Promise<ProjectSettings> {
    const rows = await this.db.query<{ data: string }>(`SELECT data FROM settings WHERE project_id = ?`, [this.projectId])
    const stored = safeJson<Partial<ProjectSettings>>(rows[0]?.data, {}) || {}
    const s = { ...DEFAULT_SETTINGS, ...stored }
    if (!Array.isArray(s.pallete)) s.pallete = []
    return s
  }

  async setSettings(settings: Partial<ProjectSettings>) {
    await this.db.run(`INSERT OR REPLACE INTO settings (project_id, data) VALUES (?, ?)`, [this.projectId, JSON.stringify(settings)])
    this.changed('settings')
    this.bus.emit('settingsUpdated')
  }

  // -------------------------------------------------------- import/export
  async importSchemas(json: any[]) {
    if (!Array.isArray(json)) throw new Error('Invalid blueprint definition')
    const stmts: SqlStatement[] = [
      { sql: `DELETE FROM fields WHERE project_id = ?`, params: [this.projectId] },
      { sql: `DELETE FROM blueprints WHERE project_id = ?`, params: [this.projectId] },
    ]
    for (const raw of json) {
      const schema: Blueprint = { ...raw, fields: (raw.fields || []).map(normaliseField) }
      stmts.push({
        sql: `INSERT INTO blueprints (project_id, id, key, label, ord, hidden, secondary, next_record_id, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          this.projectId,
          schema.id,
          schema.key,
          schema.label,
          schema.order ?? 0,
          schema.hidden ? 1 : 0,
          schema.secondary ? 1 : 0,
          schema.nextRecordId ?? 1,
          this.blueprintConfig(schema),
        ],
      })
      stmts.push(...this.fieldStatements(schema.id, schema.fields))
    }
    await this.db.batch(stmts)
    this.changed('schema')
    this.bus.emit('schemasUpdated')
  }

  async importData(json: Array<{ schemaId: number; data: DataRecord[] }>) {
    if (!Array.isArray(json)) throw new Error('Invalid data')
    const stmts: SqlStatement[] = [{ sql: `DELETE FROM records WHERE project_id = ?`, params: [this.projectId] }]
    for (const table of json) {
      if (!table || !Array.isArray(table.data)) continue
      let maxId = 0
      for (const rec of table.data) {
        const { id, ...values } = rec
        if (!id) continue
        maxId = Math.max(maxId, id)
        stmts.push({
          sql: `INSERT OR REPLACE INTO records (project_id, blueprint_id, id, data) VALUES (?, ?, ?, ?)`,
          params: [this.projectId, table.schemaId, id, JSON.stringify(values)],
        })
      }
      stmts.push({
        sql: `UPDATE blueprints SET next_record_id = MAX(next_record_id, ?) WHERE project_id = ? AND id = ?`,
        params: [maxId + 1, this.projectId, table.schemaId],
      })
    }
    await this.db.batch(stmts)
    this.changed('data')
  }

  async importSettings(json: Record<string, any>) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('Invalid settings')
    await this.setSettings(json)
  }

  /** Old exports carried file metadata separately from the file bytes. */
  async importFilesMeta(json: any) {
    const list: any[] = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []
    const stmts: SqlStatement[] = []
    for (const f of list) {
      if (!f?.id) continue
      stmts.push({
        sql: `INSERT INTO files (project_id, id, name, mime_type, size, width, height) VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(project_id, id) DO UPDATE SET name = excluded.name, mime_type = excluded.mime_type, size = excluded.size, width = excluded.width, height = excluded.height`,
        params: [this.projectId, f.id, f.name || `file-${f.id}`, f.mimeType || '', f.size || 0, f.width || 0, f.height || 0],
      })
    }
    if (stmts.length) await this.db.batch(stmts)
    this.changed('files')
  }

  async importProjectExport(json: ProjectExport) {
    if (!json || !json.blueprints || !json.data || !json.settings) throw new Error('Invalid project file')
    await this.importSchemas(json.blueprints)
    await this.importData(json.data)
    await this.importSettings(json.settings)
    if (json.files) await this.importFilesMeta(json.files)
  }

  async exportProject(): Promise<ProjectExport> {
    const [blueprints, data, settings, files] = await Promise.all([
      this.getSchemas(),
      this.getAllData(),
      this.getSettings(),
      this.getFiles('all'),
    ])
    return { blueprints, data, settings, files }
  }

  async clearAllSchemas() {
    await this.db.batch([
      { sql: `DELETE FROM records WHERE project_id = ?`, params: [this.projectId] },
      { sql: `DELETE FROM fields WHERE project_id = ?`, params: [this.projectId] },
      { sql: `DELETE FROM blueprints WHERE project_id = ?`, params: [this.projectId] },
    ])
    this.changed('schema')
    this.bus.emit('schemasUpdated')
  }

  async clearAllData() {
    await this.db.batch([
      { sql: `DELETE FROM records WHERE project_id = ?`, params: [this.projectId] },
      { sql: `UPDATE blueprints SET next_record_id = 1 WHERE project_id = ?`, params: [this.projectId] },
    ])
    this.changed('data')
  }

  async clearSettings() {
    await this.db.run(`DELETE FROM settings WHERE project_id = ?`, [this.projectId])
    this.changed('settings')
    this.bus.emit('settingsUpdated')
  }

  // ---------------------------------------------------------------- files
  private rowToFile(r: any): FileMeta {
    return {
      id: r.id,
      name: r.name,
      mimeType: r.mime_type,
      size: r.size,
      width: r.width,
      height: r.height,
      cdnUrl: null,
      thumbUrl: null,
    }
  }

  async getFiles(type: 'all' | 'image' | 'file' = 'all'): Promise<FileMeta[]> {
    const rows = await this.db.query<any>(
      `SELECT id, name, mime_type, size, width, height FROM files WHERE project_id = ? ORDER BY id`,
      [this.projectId],
    )
    const all = rows.map((r) => this.rowToFile(r))
    if (type === 'image') return all.filter((f) => ALLOWED_IMAGE_MIME_TYPES.includes(f.mimeType))
    if (type === 'file') return all.filter((f) => !ALLOWED_IMAGE_MIME_TYPES.includes(f.mimeType))
    return all
  }

  async uploadFiles(files: File[]): Promise<FileMeta[]> {
    const out: FileMeta[] = []
    for (const f of files) {
      const next = await this.db.query<{ n: number }>(`SELECT COALESCE(MAX(id), 0) + 1 AS n FROM files WHERE project_id = ?`, [
        this.projectId,
      ])
      const id = next[0].n
      const bytes = await readFileAsBytes(f)
      let width = 0
      let height = 0
      let thumb: Uint8Array | null = null
      if (ALLOWED_IMAGE_MIME_TYPES.includes(f.type)) {
        const url = bytesToDataUrl(bytes, f.type)
        try {
          const size = await getImageSize(url)
          width = size.width
          height = size.height
          thumb = await resizeImageToBytes(url, 100, 100)
        } catch (e) {
          console.warn('Could not read image', e)
        }
      }
      await this.db.run(
        `INSERT INTO files (project_id, id, name, mime_type, size, width, height, data, thumb) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [this.projectId, id, f.name, f.type, f.size, width, height, bytes, thumb],
      )
      out.push({ id, name: f.name, mimeType: f.type, size: f.size, width, height, cdnUrl: null, thumbUrl: null })
    }
    this.changed('files')
    return out
  }

  private async fileBytes(fileId: number, column: 'data' | 'thumb'): Promise<{ bytes: Uint8Array | null; mime: string }> {
    const rows = await this.db.query<{ blob: Uint8Array | null; mime_type: string }>(
      `SELECT ${column} AS blob, mime_type FROM files WHERE project_id = ? AND id = ?`,
      [this.projectId, fileId],
    )
    if (!rows.length) return { bytes: null, mime: '' }
    const b = rows[0].blob
    return { bytes: b ? (b instanceof Uint8Array ? b : new Uint8Array(b as any)) : null, mime: rows[0].mime_type }
  }

  async getFileDataUrl(fileId: number): Promise<string> {
    const { bytes, mime } = await this.fileBytes(fileId, 'data')
    return bytes ? bytesToDataUrl(bytes, mime || 'application/octet-stream') : ''
  }

  async getImageDataUrl(fileId: number, thumb = false): Promise<string> {
    const { bytes, mime } = await this.fileBytes(fileId, thumb ? 'thumb' : 'data')
    if (bytes) return bytesToDataUrl(bytes, thumb ? 'image/png' : mime || 'image/png')
    if (thumb) return this.getImageDataUrl(fileId, false)
    return ''
  }

  async getFileBlob(fileId: number): Promise<Blob | null> {
    const { bytes, mime } = await this.fileBytes(fileId, 'data')
    return bytes ? new Blob([bytes as BlobPart], { type: mime || 'application/octet-stream' }) : null
  }

  async removeFile(fileId: number) {
    await this.db.run(`DELETE FROM files WHERE project_id = ? AND id = ?`, [this.projectId, fileId])
    this.changed('files')
  }

  async getAllFilesAsJson(): Promise<string> {
    const files = await this.getFiles('all')
    const json: FilesExport = { files: {}, thumbs: {} }
    for (const f of files) {
      json.files[f.id] = await this.getFileDataUrl(f.id)
      if (ALLOWED_IMAGE_MIME_TYPES.includes(f.mimeType)) json.thumbs[f.id] = await this.getImageDataUrl(f.id, true)
    }
    return JSON.stringify(json)
  }

  async setFileFromImport(fileId: number, fileAsBase64Url: string, thumb = false) {
    if (!fileAsBase64Url) return
    const { bytes, mime } = dataUrlToBytes(fileAsBase64Url)
    const exists = await this.db.query<{ id: number }>(`SELECT id FROM files WHERE project_id = ? AND id = ?`, [this.projectId, fileId])
    if (!exists.length) {
      await this.db.run(`INSERT INTO files (project_id, id, name, mime_type, size) VALUES (?, ?, ?, ?, ?)`, [
        this.projectId,
        fileId,
        `file-${fileId}`,
        mime,
        bytes.length,
      ])
    }
    if (thumb) {
      await this.db.run(`UPDATE files SET thumb = ? WHERE project_id = ? AND id = ?`, [bytes, this.projectId, fileId])
    } else {
      await this.db.run(`UPDATE files SET data = ?, size = CASE WHEN size = 0 THEN ? ELSE size END WHERE project_id = ? AND id = ?`, [
        bytes,
        bytes.length,
        this.projectId,
        fileId,
      ])
    }
    this.changed('files')
  }

  // ------------------------------------------------------------ raw SQL
  /** (Re)creates one SQL view per blueprint of the current project. */
  async rebuildViews(force = false) {
    if (!this.viewsDirty && !force) return
    const existing = await this.db.query<{ name: string }>(`SELECT name FROM sqlite_temp_master WHERE type = 'view'`)
    const drops = existing.map((v) => `DROP VIEW IF EXISTS temp."${v.name.replace(/"/g, '""')}";`).join('\n')
    const schemas = await this.getSchemas()
    const sql = `${drops}\n${buildViewsSql(this.projectId, schemas)}`
    if (sql.trim()) await this.db.exec(sql)
    this.viewsDirty = false
  }

  /** Runs read-only SQL against the blueprint views. */
  async runSql(sql: string): Promise<Record<string, any>[]> {
    await this.rebuildViews()
    return this.db.query(sql)
  }

  // --------------------------------------------------------- whole database
  exportDatabase(): Promise<Uint8Array> {
    return this.db.exportDb()
  }

  async importDatabase(bytes: Uint8Array) {
    await this.db.importDb(bytes)
    const { SCHEMA_SQL } = await import('@/db/schema')
    await this.db.exec(SCHEMA_SQL)
    await this.init()
    this.viewsDirty = true
    this.changed('database')
    this.bus.emit('databaseReplaced')
  }
}
