// ---------------------------------------------------------------------------
// Domain types. These mirror the shapes the old JSON files used so the old
// export/import format keeps working, but the storage underneath is SQLite.
// ---------------------------------------------------------------------------

export type FieldTypeKey =
  | 'text'
  | 'number'
  | 'link'
  | 'date'
  | 'boolean'
  | 'sub'
  | 'color'
  | 'image'
  | 'file'
  | 'language'
  | 'country'
  | 'map'

export interface Project {
  id: number
  key: string
  label: string
  order: number
}

export interface Field {
  id: number
  key: string
  label: string
  type: FieldTypeKey
  order: number
  required?: boolean
  hideInList?: boolean
  help?: string
  params: Record<string, any>
}

export interface Blueprint {
  id: number
  key: string
  label: string
  fields: Field[]
  order?: number
  hidden?: boolean
  secondary?: boolean
  nextRecordId?: number
  description?: string
  filteringAllowed?: boolean
  bookmarkingAllowed?: boolean
  defaultSorting?: number | null
  defaultSortingOrder?: 'asc' | 'desc'
  uniqueField?: number | null
  uniqueFieldFuzzy?: boolean
  linkFieldDisplayDefault?: number | null
  linkFieldDisplayDefaultSecondary?: number | null
}

/** The light list shape used by the sidebar and select options. */
export interface BlueprintSummary {
  id: number
  key: string
  label: string
  hidden?: boolean
  secondary?: boolean
}

export type DataRecord = { id: number } & Record<string, any>

export interface FileMeta {
  id: number
  name: string
  mimeType: string
  size: number
  width: number
  height: number
  cdnUrl?: string | null
  thumbUrl?: string | null
}

export interface ProjectSettings {
  highlightColor: string
  highlightTextColor: string
  name: string
  icon: string
  homeText: string
  pallete: string[]
  defaultDateDataFormat?: string
  defaultDateDisplayFormat?: string
  [key: string]: any
}

/** The old `cocktail.<project>.all.json` export format. */
export interface ProjectExport {
  blueprints: Blueprint[]
  data: Array<{ schemaId: number; data: DataRecord[] }>
  settings: Partial<ProjectSettings>
  files?: FileMeta[]
}

/** The old `cocktail.<project>.files.json` export format. */
export interface FilesExport {
  files: Record<string, string>
  thumbs: Record<string, string>
}

export type LinkedData = Record<number, Blueprint & { data: DataRecord[] }>
