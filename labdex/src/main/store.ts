import { existsSync, mkdirSync, readFileSync, renameSync, copyFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { LabCore, createSeedDb, type DbFile } from '@shared/core'

/** Writes JSON atomically (temp file + rename), keeping a .bak of the previous version. */
export function writeJsonAtomic(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  if (existsSync(file)) copyFileSync(file, `${file}.bak`)
  renameSync(tmp, file)
}

/** Desktop persistence for the test directory: one JSON file. */
export function openStore(file: string): LabCore {
  const write = (db: DbFile) => writeJsonAtomic(file, db)

  if (existsSync(file)) {
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as { schemaVersion?: number }
      // Keep a copy of data from an older LabDex before it is upgraded.
      if (raw.schemaVersion !== 2) copyFileSync(file, `${file}.v${raw.schemaVersion ?? 1}-backup`)
      return new LabCore(raw, write)
    } catch (err) {
      // Keep the unreadable file for recovery instead of overwriting it.
      renameSync(file, `${file}.corrupt-${Date.now()}`)
      console.error('LabDex data file was unreadable and has been set aside', err)
    }
  }
  const db = createSeedDb()
  write(db)
  return new LabCore(db, write)
}
