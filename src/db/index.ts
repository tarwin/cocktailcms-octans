import { platform } from '@/core/platform'
import type { SqlDriver } from './driver'
import { SCHEMA_SQL } from './schema'
import { TinyjsDriver } from './drivers/TinyjsDriver'
import { WasmDriver } from './drivers/WasmDriver'

export type { SqlDriver, Row, SqlParams, SqlStatement } from './driver'

export function createDriver(): SqlDriver {
  if (platform === 'tinyjs') return new TinyjsDriver()
  return new WasmDriver()
}

/** Opens the driver and makes sure the schema exists. */
export async function openDatabase(driver: SqlDriver = createDriver()): Promise<SqlDriver> {
  await driver.init()
  await driver.exec(SCHEMA_SQL)
  return driver
}
