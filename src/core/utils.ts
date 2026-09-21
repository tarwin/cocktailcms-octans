import type { Blueprint, DataRecord, Field, FieldTypeKey, LinkedData } from './types'

export interface TypeOption {
  value: FieldTypeKey
  label: string
  sortable?: boolean | ((field: Field) => boolean)
  fuzzy?: boolean
  linkDisplayable?: boolean
}

export const TYPE_OPTIONS: TypeOption[] = [
  { value: 'text', label: 'Text', sortable: true, fuzzy: true, linkDisplayable: true },
  { value: 'number', label: 'Number', sortable: true, linkDisplayable: true },
  { value: 'boolean', label: 'Boolean', sortable: true, linkDisplayable: true },
  { value: 'date', label: 'Date', sortable: true, linkDisplayable: true },
  { value: 'link', label: 'Link to Blueprint', sortable: (f) => !f?.params?.allowMultiple },
  { value: 'sub', label: 'Sub-Blueprint' },
  { value: 'color', label: 'Color', sortable: true, linkDisplayable: true },
  { value: 'image', label: 'Image', linkDisplayable: true },
  { value: 'file', label: 'File', linkDisplayable: true },
  { value: 'country', label: 'Country', sortable: true, linkDisplayable: true },
  { value: 'language', label: 'Language', sortable: true, linkDisplayable: true },
  { value: 'map', label: 'Map' },
]

/** What SQL/JS data type each field type holds; used by the export page. */
export const TYPE_DATA_TYPE: Record<string, string | null> = {
  text: 'String',
  number: 'Number',
  link: null,
  date: 'Date',
  boolean: 'Boolean',
  sub: null,
  color: 'Color',
  image: 'String',
  file: 'String',
  language: 'String',
  country: 'String',
  map: 'LatLong',
}

export const TYPE_DATA_DEFAULT: Record<string, any> = {
  text: '',
  number: 0,
  link: '',
  date: '1970-01-01',
  boolean: false,
  sub: '',
  color: '#000000',
  image: '',
  file: '',
  language: '',
  country: '',
  map: '',
  LINK_SUM: 0,
  SUB_COUNT: 0,
}

export const ALLOWED_IMAGE_MIME_TYPES = ['image/png', 'image/gif', 'image/jpeg', 'image/webp', 'image/svg+xml']

export const RESERVED_KEYS = ['id', 'order', 'updatedon', 'updatedby', 'createdon', 'createdby', 'locked']

export function getKeyFromLabel(name: string): string {
  let s = name || ''
  s = s.replace(/ /g, '-').toLowerCase()
  s = s.replace(/[^a-z0-9\-_]/g, '')
  s = s.replace(/^[0-9]+/g, '')
  s = s.replace(/^[-]+/g, '')
  return s
}

export function isFunction(fn: unknown): fn is (...args: any[]) => any {
  return typeof fn === 'function'
}

export function deepCopy<T>(obj: T): T {
  if (obj === undefined || obj === null) return obj
  return JSON.parse(JSON.stringify(obj))
}

export function safeJson<T = any>(str: string | null | undefined, fallback: T | null = null): T | null {
  if (!str) return fallback
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}

export function fieldCanBeSorted(field: Field): boolean {
  const lookup = TYPE_OPTIONS.find((t) => t.value === field.type)
  if (!lookup) return false
  return isFunction(lookup.sortable) ? lookup.sortable(field) : !!lookup.sortable
}

export function typesThatCanBeDisplayedInLink(): string[] {
  return TYPE_OPTIONS.filter((t) => t.linkDisplayable).map((t) => t.value)
}

export function typesThatCanBeFuzzy(): string[] {
  return TYPE_OPTIONS.filter((t) => t.fuzzy).map((t) => t.value)
}

export function getTypeLabel(type: string): string {
  return TYPE_OPTIONS.find((t) => t.value === type)?.label || type
}

/** Old exports used `int` / `float` as field types; fold them into `number`. */
export function normaliseField(field: any): Field {
  const f = { ...field, params: { ...(field.params || {}) } }
  if (f.type === 'int' || f.type === 'float') {
    f.params.type = f.type
    f.type = 'number'
  }
  if (typeof f.order !== 'number') f.order = parseFloat(f.order) || 0
  return f as Field
}

export function getFileTypeIcon(mime: string | undefined): string {
  if (!mime) return 'mdi:file-outline'
  if (mime === 'application/pdf') return 'mdi:file-pdf-box'
  if (mime.startsWith('image/')) return 'mdi:file-image-outline'
  if (mime.startsWith('video/')) return 'mdi:file-video-outline'
  if (mime.startsWith('audio/')) return 'mdi:file-music-outline'
  if (mime.includes('zip') || mime.includes('compressed') || mime.includes('tar')) return 'mdi:folder-zip-outline'
  if (mime.includes('word')) return 'mdi:file-word-outline'
  if (mime.includes('excel') || mime.includes('spreadsheet') || mime === 'text/csv') return 'mdi:file-excel-outline'
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'mdi:file-powerpoint-outline'
  if (mime.startsWith('text/') || mime.includes('json') || mime.includes('javascript')) return 'mdi:file-code-outline'
  return 'mdi:file-outline'
}

/**
 * Old data stored FontAwesome class strings (`fas fa-star`). Octans draws
 * Iconify names, so translate on the fly; Iconify names pass straight through.
 */
export function toIconName(icon: string | undefined | null): string {
  if (!icon) return ''
  const s = icon.trim()
  if (s.includes(':')) return s
  const parts = s.split(/\s+/)
  const style = parts.find((p) => ['fas', 'far', 'fal', 'fad', 'fab', 'fa-solid', 'fa-regular', 'fa-brands'].includes(p))
  const name = parts.find((p) => p.startsWith('fa-') && !p.match(/^fa-(lg|sm|xs|2x|3x|fw|spin|solid|regular|brands|light|duotone)$/))
  if (name) {
    const n = name.slice(3)
    if (style === 'far' || style === 'fal' || style === 'fa-regular') return `fa6-regular:${n}`
    if (style === 'fab' || style === 'fa-brands') return `fa6-brands:${n}`
    return `fa6-solid:${n}`
  }
  return `mdi:${s}`
}

export function getDefaultRecord(blueprint: Blueprint): Record<string, any> {
  const record: Record<string, any> = {}
  for (const f of blueprint.fields) {
    const dv = f.params?.defaultValue
    if (f.type === 'text' || f.type === 'number' || f.type === 'date') {
      record[f.key] = dv !== null && dv !== undefined ? dv : ''
    } else {
      record[f.key] = dv !== null && dv !== undefined ? dv : null
    }
  }
  return record
}

export function orderBy<T>(list: T[], key: keyof T | ((item: T) => any), direction: 'asc' | 'desc' = 'asc'): T[] {
  const get = isFunction(key) ? key : (item: T) => item[key as keyof T]
  const dir = direction === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    const av = get(a)
    const bv = get(b)
    if (av === bv) return 0
    if (av === null || av === undefined) return 1
    if (bv === null || bv === undefined) return -1
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir
  })
}

export function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

export function debounce<T extends (...args: any[]) => void>(fn: T, wait: number): T & { flush(): void; cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastArgs: any[] | null = null
  const wrapped = ((...args: any[]) => {
    lastArgs = args
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      const a = lastArgs
      lastArgs = null
      if (a) fn(...a)
    }, wait)
  }) as T & { flush(): void; cancel(): void }
  wrapped.flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
      const a = lastArgs
      lastArgs = null
      if (a) fn(...a)
    }
  }
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
    lastArgs = null
  }
  return wrapped
}

// --- table limit preference (per browser) ---------------------------------
export function getDefaultTableLimit(): number {
  try {
    return parseInt(window.localStorage.getItem('_dataTableLimit') || '', 10) || 10
  } catch {
    return 10
  }
}
export function setDefaultTableLimit(limit: number) {
  try {
    window.localStorage.setItem('_dataTableLimit', String(limit))
  } catch {
    /* ignore */
  }
}

// --- CSV ------------------------------------------------------------------
export function csvCell(x: any): string {
  if (x === null || x === undefined) return ''
  if (typeof x === 'number') return String(x)
  if (typeof x === 'boolean') return x ? '1' : '0'
  const s = typeof x === 'string' ? x : JSON.stringify(x)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function arrayToCsv(rows: any[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n'
}

// --- downloads ------------------------------------------------------------
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 250)
}

export function downloadText(text: string, filename: string, mime = 'application/octet-stream') {
  downloadBlob(new Blob([text], { type: mime }), filename)
}

export function pickFile(accept = ''): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    if (accept) input.accept = accept
    input.style.display = 'none'
    input.onchange = () => {
      resolve(input.files?.[0] || null)
      input.remove()
    }
    document.body.appendChild(input)
    input.click()
  })
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onerror = reject
    fr.onload = () => resolve(fr.result as string)
    fr.readAsText(file, 'UTF-8')
  })
}

export function readFileAsBytes(file: File): Promise<Uint8Array> {
  return file.arrayBuffer().then((b) => new Uint8Array(b))
}

// --- bytes / base64 / data urls -------------------------------------------
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
  }
  return btoa(bin)
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const m = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s)
  if (!m) throw new Error('Not a data URL')
  const mime = m[1] || 'application/octet-stream'
  if (m[2]) return { bytes: base64ToBytes(m[3]), mime }
  return { bytes: new TextEncoder().encode(decodeURIComponent(m[3])), mime }
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  return `data:${mime};base64,${bytesToBase64(bytes)}`
}

export function prettyBytes(n: number): string {
  if (!n && n !== 0) return ''
  const units = ['B', 'kB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

// --- images ---------------------------------------------------------------
export function getImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onerror = reject
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.src = url
  })
}

export function resizeImageToBytes(url: string, width: number, height: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onerror = reject
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      // cover-fit crop
      const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight)
      const w = img.naturalWidth * scale
      const h = img.naturalHeight * scale
      ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h)
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Could not create thumbnail'))
        blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)))
      }, 'image/png')
    }
    img.src = url
  })
}

/** Loads the linked blueprints (and their display data) a blueprint refers to. */
export async function loadLinkedData(
  blueprint: Blueprint,
  api: { getSchema(id: number): Promise<Blueprint | null>; getData(id: number, fields?: string[] | null): Promise<DataRecord[]> },
  onlyFieldKeys: string[] | null = null,
): Promise<LinkedData> {
  const toLoad: Record<number, { id: number; fields: string[] }> = {}
  for (const f of blueprint.fields) {
    if ((!onlyFieldKeys || onlyFieldKeys.includes(f.key)) && f.type === 'link') {
      if (!f.params) throw new Error(`Missing params for link: ${f.label}`)
      const id = Number(f.params.linkId)
      if (!toLoad[id]) toLoad[id] = { id, fields: [] }
      toLoad[id].fields.push(f.params.linkFieldDisplay)
      if (f.params.linkFieldDisplayDesc) toLoad[id].fields.push(f.params.linkFieldDisplayDesc)
    }
  }
  const out: LinkedData = {}
  await Promise.all(
    Object.values(toLoad).map(async (t) => {
      const [schema, data] = await Promise.all([api.getSchema(t.id), api.getData(t.id, [...new Set(t.fields)])])
      if (schema) out[schema.id] = { ...schema, data }
    }),
  )
  return out
}

/**
 * A keydown handler that treats Enter in a plain text input as "submit",
 * without wrapping the fields in a <form> (where any button would submit).
 */
export function enterSubmits(fn: () => void) {
  return (e: KeyboardEvent) => {
    const t = e.target as HTMLInputElement | null
    if (!t || t.tagName !== 'INPUT') return
    if (!['text', 'number', 'email', 'tel', 'url', 'search'].includes(t.type)) return
    if (t.closest('[role="combobox"], [role="listbox"], [aria-haspopup], .Select')) return
    e.preventDefault()
    fn()
  }
}
