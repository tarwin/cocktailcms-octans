import type { Blueprint } from '@/core/types'

/** SQL identifier quoting (double quotes, doubled inside). */
export function q(ident: string): string {
  return `"${String(ident).replace(/"/g, '""')}"`
}

/** JSON path for a record field key. Keys are validated to [a-z0-9-_]. */
export function jsonPath(key: string): string {
  return `'$."${key.replace(/"/g, '')}"'`
}

/** The expression that reads one field out of the record JSON. */
export function fieldExpr(field: { key: string; type: string }, alias = 'data'): string {
  const raw = `json_extract(${alias}, ${jsonPath(field.key)})`
  if (field.type === 'number') return `CAST(${raw} AS REAL)`
  return raw
}

/**
 * One SQL view per blueprint, named after the blueprint key, so the export
 * page (and anyone poking at the database) can write plain SQL against the
 * user's data. Views are TEMP (per connection) and rebuilt whenever the
 * blueprints or the current project change.
 */
export function buildViewsSql(projectId: number, blueprints: Blueprint[]): string {
  const parts: string[] = []
  for (const b of blueprints) {
    const cols = [`id`]
    for (const f of b.fields) {
      if (f.type === 'sub') continue // subs are the other table's link back
      cols.push(`${fieldExpr(f)} AS ${q(f.key)}`)
    }
    cols.push(`created_at`, `updated_at`)
    parts.push(`DROP VIEW IF EXISTS temp.${q(b.key)};`)
    parts.push(
      `CREATE TEMP VIEW ${q(b.key)} AS SELECT ${cols.join(', ')} FROM records WHERE project_id = ${projectId} AND blueprint_id = ${b.id};`,
    )
  }
  return parts.join('\n')
}
