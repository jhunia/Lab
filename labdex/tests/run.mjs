// Runs every tests/*.test.ts: each is bundled with esbuild (the shared engine is plain TypeScript)
// and executed with Node. Exit code 1 if any check fails.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const out = mkdtempSync(join(tmpdir(), 'labdex-tests-'))
const only = process.argv[2]
let failed = 0

for (const file of readdirSync(here).filter((f) => f.endsWith('.test.ts') && (!only || f.startsWith(only)))) {
  const bundle = join(out, file.replace(/\.ts$/, '.cjs'))
  execFileSync('npx', ['-y', 'esbuild@0.25.10', join(here, file), '--bundle', '--platform=node', '--log-level=error', `--outfile=${bundle}`], { stdio: 'inherit', shell: true })
  const text = execFileSync(process.execPath, [bundle], { encoding: 'utf8' })
  const fails = text.split('\n').filter((l) => l.startsWith('FAIL'))
  failed += fails.length
  console.log(`${fails.length ? '✗' : '✓'} ${file}  ${text.trim().split('\n').at(-1)}`)
  for (const f of fails) console.log(`    ${f}`)
}

rmSync(out, { recursive: true, force: true })
process.exit(failed ? 1 : 0)
