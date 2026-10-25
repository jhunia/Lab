// Copies the shared data engine (types, validation, core, CSV, search, sync, seed, helpers)
// from the desktop app into ./shared so cloud builds (EAS) have it.
// Edit the originals in ../labdex/src/shared, then run: npm run sync-shared
//
// Files are updated in place (never delete-and-recreate the folder): Metro's file watcher
// can lose track of a replaced folder and keep serving stale code.
const fs = require('fs')
const path = require('path')

const src = path.resolve(__dirname, '../../labdex/src/shared')
const dest = path.resolve(__dirname, '../shared')
const banner = '// AUTO-COPIED from labdex/src/shared by `npm run sync-shared`. Do not edit here.\n'

if (!fs.existsSync(src)) {
  console.error(`Shared source not found: ${src}`)
  process.exit(1)
}
fs.mkdirSync(dest, { recursive: true })

const files = fs.readdirSync(src).filter((f) => f.endsWith('.ts'))
let changed = 0
for (const f of files) {
  const next = banner + fs.readFileSync(path.join(src, f), 'utf8')
  const target = path.join(dest, f)
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== next) {
    fs.writeFileSync(target, next)
    changed++
  }
}
// Remove copies whose originals no longer exist.
for (const f of fs.readdirSync(dest)) {
  if (f.endsWith('.ts') && !files.includes(f)) fs.rmSync(path.join(dest, f))
}
console.log(`Shared files: ${files.length} (${changed} updated) → shared/`)
