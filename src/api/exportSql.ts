// ---------------------------------------------------------------------------
// SQL generation for the Data Export page, targeting SQLite (the blueprint
// views built in `views.ts`). This replaces the old alasql dialect.
// ---------------------------------------------------------------------------
import type { Blueprint, Field } from '@/core/types'
import Graph from '@/core/graph'

export interface ExportField extends Field {
  globalKey: string
  schema: Blueprint
  extra: { default: any }
}

export interface CustomField {
  id?: number
  globalKey: string
  label: string
  auto?: boolean
  type: string
  schema: Blueprint
  params?: { field: ExportField }
  extra: { default: any }
  custom?: any
}

const bt = (s: string) => `\`${String(s).replace(/`/g, '')}\``
const lit = (v: any) => (typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v === null || v === undefined ? 'NULL' : String(v))

export const DATE_TYPES = ['DATE_DAY', 'DATE_DAY_OF_WEEK', 'DATE_DAY_OF_WEEK_NUM', 'DATE_MONTH', 'DATE_YEAR', 'DATE_YEAR_MONTH']

function linkSum(f: CustomField, withAlias = true) {
  const field = f.params!.field
  let out = `IFNULL(json_array_length(${bt(f.schema.key)}.${bt(field.key)}), ${lit(f.extra.default)})`
  if (withAlias) out += ` AS ${bt(f.globalKey)}`
  return out
}

function subCount(f: CustomField, schemaById: Record<number, Blueprint>, withAlias = true) {
  const field = f.params!.field
  const child = schemaById[Number(field.params.linkId)]
  let out = `IFNULL((SELECT COUNT(*) FROM ${bt(child.key)} c WHERE c.${bt(field.params.linkFieldId)} = ${bt(f.schema.key)}.id), ${lit(f.extra.default)})`
  if (withAlias) out += ` AS ${bt(f.globalKey)}`
  return out
}

function stringJoin(f: CustomField, customFields: Record<string, CustomField[]>, schemaById: Record<number, Blueprint>) {
  const parts = (f.custom?.fields || []).map((sel: { value: string }) => {
    const name = sel.value
    if (name.startsWith('auto___')) {
      const auto = (customFields[f.schema.key] || []).find((a) => a.globalKey === name)
      if (auto?.type === 'LINK_SUM') return linkSum(auto, false)
      if (auto?.type === 'SUB_COUNT') return subCount(auto, schemaById, false)
      return `''`
    }
    return `IFNULL(${bt(f.schema.key)}.${bt(name)}, '')`
  })
  const sep = lit(f.custom?.separator || '')
  return `(${parts.join(` || ${sep} || `) || `''`}) AS ${bt(f.globalKey)}`
}

function simpleMath(f: CustomField, customFields: Record<string, CustomField[]>, schemaById: Record<number, Blueprint>) {
  const tokens = String(f.custom?.formulaSql || '0').split(/(`[^`]+`)/)
  let out = '('
  for (const token of tokens) {
    if (!token) continue
    if (token.startsWith('`') && token.endsWith('`')) {
      const name = token.slice(1, -1)
      if (name.startsWith('auto___')) {
        const auto = (customFields[f.schema.key] || []).find((a) => a.globalKey === name)
        if (auto?.type === 'LINK_SUM') out += `(${linkSum(auto, false)})`
        else if (auto?.type === 'SUB_COUNT') out += `(${subCount(auto, schemaById, false)})`
        else out += '0'
      } else {
        out += `CAST(IFNULL(${bt(f.schema.key)}.${bt(name)}, 0) AS REAL)`
      }
      continue
    }
    out += token
  }
  return `${out}) AS ${bt(f.globalKey)}`
}

function dateExpr(type: string, col: string): string {
  switch (type) {
    case 'DATE_DAY':
      return `CAST(strftime('%d', ${col}) AS INTEGER)`
    case 'DATE_DAY_OF_WEEK':
      return `CASE strftime('%w', ${col}) WHEN '0' THEN 'Sunday' WHEN '1' THEN 'Monday' WHEN '2' THEN 'Tuesday' WHEN '3' THEN 'Wednesday' WHEN '4' THEN 'Thursday' WHEN '5' THEN 'Friday' WHEN '6' THEN 'Saturday' END`
    case 'DATE_DAY_OF_WEEK_NUM':
      return `CAST(strftime('%w', ${col}) AS INTEGER)`
    case 'DATE_MONTH':
      return `CAST(strftime('%m', ${col}) AS INTEGER)`
    case 'DATE_YEAR':
      return `CAST(strftime('%Y', ${col}) AS INTEGER)`
    case 'DATE_YEAR_MONTH':
      return `strftime('%Y-%m-01', ${col})`
    default:
      return col
  }
}

/**
 * Builds the SELECT for the chosen fields, joining the blueprints along the
 * link/sub relationships in `graph` (already trimmed to the ones in use).
 */
export function buildExportSql(
  graph: Graph,
  chosenSchemas: Blueprint[],
  schemaByKey: Record<string, Blueprint>,
  schemaById: Record<number, Blueprint>,
  selectedFields: ExportField[],
  selectedCustomFields: CustomField[],
  customFields: Record<string, CustomField[]>,
): string {
  const topological = graph.topologicalSort(graph.nodes())

  const subs = new Set<string>()
  for (const schema of chosenSchemas) {
    for (const field of schema.fields.filter((f) => f.type === 'sub')) {
      const child = schemaById[Number(field.params.linkId)]
      if (child) subs.add(`${schema.key}=>${child.key}`)
    }
  }

  const joins: Record<string, string[]> = {}
  for (const schemaKey of topological) {
    const schema = schemaByKey[schemaKey]
    if (!schema) continue
    for (const field of schema.fields) {
      if (field.type === 'link') {
        const to = schemaById[Number(field.params.linkId)]
        if (!to || !topological.includes(to.key)) continue
        if (subs.has(`${to.key}=>${schema.key}`)) continue
        if (!joins[to.key]) joins[to.key] = []
        if (field.params.allowMultiple) {
          joins[to.key].push(`EXISTS (SELECT 1 FROM json_each(${bt(schema.key)}.${bt(field.key)}) je WHERE je.value = ${bt(to.key)}.id)`)
        } else {
          joins[to.key].push(`${bt(to.key)}.id = ${bt(schema.key)}.${bt(field.key)}`)
        }
      } else if (field.type === 'sub') {
        const child = schemaById[Number(field.params.linkId)]
        if (!child || !topological.includes(child.key)) continue
        if (!joins[child.key]) joins[child.key] = []
        joins[child.key].push(`${bt(child.key)}.${bt(field.params.linkFieldId)} = ${bt(schema.key)}.id`)
      }
    }
  }

  const selects = selectedFields.map((f) => `IFNULL(${bt(f.schema.key)}.${bt(f.key)}, ${lit(f.extra.default)}) AS ${bt(f.globalKey)}`)
  for (const f of selectedCustomFields) {
    if (f.type === 'LINK_SUM') selects.push(linkSum(f))
    else if (f.type === 'SUB_COUNT') selects.push(subCount(f, schemaById))
    else if (DATE_TYPES.includes(f.type)) selects.push(`${dateExpr(f.type, `${bt(f.schema.key)}.${bt(f.custom)}`)} AS ${bt(f.globalKey)}`)
    else if (f.type === 'MATH_SIMPLE') selects.push(simpleMath(f, customFields, schemaById))
    else if (f.type === 'STRING_JOIN') selects.push(stringJoin(f, customFields, schemaById))
    else selects.push(`NULL AS ${bt(f.globalKey)}`)
  }

  let sql = `SELECT\n  ${selects.join(',\n  ')}\nFROM ${bt(topological[0])}`
  for (let i = 1; i < topological.length; i++) {
    const on = joins[topological[i]]
    if (on && on.length) sql += `\nLEFT JOIN ${bt(topological[i])} ON ${on.join(' OR ')}`
    else sql += `\nCROSS JOIN ${bt(topological[i])}`
  }
  return sql
}

/** Very small arithmetic evaluator for validating "simple math" formulas. */
export function evalArithmetic(expr: string): number {
  let i = 0
  const s = expr.replace(/\s+/g, '')
  const peek = () => s[i]
  const next = () => s[i++]
  function parseNumber(): number {
    const m = s.slice(i).match(/^\d+(\.\d+)?/)
    if (!m) throw new Error('number expected')
    i += m[0].length
    return parseFloat(m[0])
  }
  function factor(): number {
    if (peek() === '(') {
      next()
      const v = expression()
      if (next() !== ')') throw new Error(') expected')
      return v
    }
    if (peek() === '-') {
      next()
      return -factor()
    }
    if (peek() === '+') {
      next()
      return factor()
    }
    return parseNumber()
  }
  function term(): number {
    let v = factor()
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = next()
      const r = factor()
      v = op === '*' ? v * r : op === '/' ? v / r : v % r
    }
    return v
  }
  function expression(): number {
    let v = term()
    while (peek() === '+' || peek() === '-') {
      const op = next()
      const r = term()
      v = op === '+' ? v + r : v - r
    }
    return v
  }
  const result = expression()
  if (i !== s.length) throw new Error('unexpected input')
  if (!Number.isFinite(result)) throw new Error('not finite')
  return result
}
