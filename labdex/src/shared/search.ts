// Test search shared by desktop and mobile.
// Every word typed must match something on the test. Matches are scored so that
// exact codes and name/synonym starts rank first, then contains, then typo-tolerant
// matches, then weaker fields (sample type, department, description).
import type { Department, LabTest } from './types'

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9&+]+/g, ' ')
    .trim()

const words = (s: string) => norm(s).split(' ').filter(Boolean)

/** Damerau–Levenshtein distance, stopping early once it exceeds `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      rowMin = Math.min(rowMin, d[i][j])
    }
    if (rowMin > max) return max + 1
  }
  return d[a.length][b.length]
}

/** Typos allowed for a query word of this length. */
const allowedTypos = (len: number) => (len >= 8 ? 2 : len >= 4 ? 1 : 0)

interface Indexed {
  test: LabTest
  code: string
  codeParts: string[]
  name: string
  nameWords: string[]
  synonyms: string[]
  synonymWords: string[]
  sampleWords: string[]
  deptWords: string[]
  descWords: string[]
}

function index(t: LabTest, deptName: string): Indexed {
  const code = norm(t.code).replace(/ /g, '')
  return {
    test: t,
    code,
    codeParts: words(t.code.replace(/-/g, ' ')),
    name: norm(t.name),
    nameWords: words(t.name),
    synonyms: t.synonyms.map(norm),
    synonymWords: t.synonyms.flatMap(words),
    sampleWords: t.specimens.flatMap((s) => words(s.sampleType)),
    deptWords: words(deptName),
    descWords: words(t.description)
  }
}

/** Best score for one query word against one test, or 0 if it doesn't match. */
function scoreWord(q: string, x: Indexed): number {
  let best = 0
  const take = (n: number) => {
    if (n > best) best = n
  }

  // Code: "fbc", "haem-fbc", "haemfbc"
  if (x.code === q) take(120)
  else if (x.codeParts.includes(q)) take(100)
  else if (x.code.startsWith(q) || x.codeParts.some((p) => p.startsWith(q))) take(70)

  // Synonyms / abbreviations: "cbc", "u&e", "pap"
  if (x.synonyms.includes(q) || x.synonymWords.includes(q)) take(95)
  else if (x.synonymWords.some((w) => w.startsWith(q))) take(65)

  // Name words: "blood", "hae" → haemoglobin
  if (x.nameWords.includes(q)) take(85)
  else if (x.nameWords.some((w) => w.startsWith(q))) take(q.length >= 3 ? 70 : 45)
  else if (q.length >= 3 && x.name.includes(q)) take(40)

  // Typos: "glucoze", "hemoglobin", "creatinin"
  const typos = allowedTypos(q.length)
  if (best === 0 && typos > 0) {
    const fuzzy = [...x.nameWords, ...x.synonymWords].some((w) => w.length >= 4 && distance(q, w.slice(0, Math.max(q.length, w.length)), typos) <= typos)
    const fuzzyPrefix = [...x.nameWords, ...x.synonymWords].some((w) => w.length > q.length && distance(q, w.slice(0, q.length), typos) <= typos)
    if (fuzzy) take(35)
    else if (fuzzyPrefix && q.length >= 5) take(25)
  }

  // Weaker fields
  if (x.sampleWords.some((w) => w === q || (q.length >= 3 && w.startsWith(q)))) take(30)
  if (x.deptWords.some((w) => w === q || (q.length >= 4 && w.startsWith(q)))) take(22)
  if (q.length >= 4 && x.descWords.some((w) => w.startsWith(q))) take(10)

  return best
}

export interface SearchOptions {
  departments?: Department[]
}

/** Returns matching tests, best first. An empty query returns the list unchanged. */
export function searchTests(tests: LabTest[], query: string, opts: SearchOptions = {}): LabTest[] {
  const qs = words(query)
  if (qs.length === 0) return tests
  const depName = new Map((opts.departments ?? []).map((d) => [d.id, d.name]))
  const whole = norm(query).replace(/ /g, '')

  const scored: { t: LabTest; score: number }[] = []
  for (const t of tests) {
    const x = index(t, depName.get(t.departmentId) ?? '')
    let total = 0
    let ok = true
    for (const q of qs) {
      const s = scoreWord(q, x)
      if (s === 0) {
        ok = false
        break
      }
      total += s
    }
    if (!ok) {
      // Allow a code typed without its dash, e.g. "chemglu"
      if (qs.length === 1 && x.code.startsWith(whole)) total = 90
      else continue
    }
    // Bonus when the whole query is the start of the name ("full blood")
    if (qs.length > 1 && x.name.startsWith(norm(query))) total += 40
    scored.push({ t, score: total })
  }
  return scored.sort((a, b) => b.score - a.score || a.t.name.localeCompare(b.t.name)).map((s) => s.t)
}
