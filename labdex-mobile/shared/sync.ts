// AUTO-COPIED from labdex/src/shared by `npm run sync-shared`. Do not edit here.
// Update-file sync, shared by desktop and mobile. An editor publishes one JSON file
// (see LabCore.exportPackage) to a shared location; every device checks its link and
// offers to sync when the file's revision is newer than what it last applied.
// When the Supabase backend arrives, it replaces `fetchPackage` — the rest stays.
import { parsePackage, type UpdatePackage } from './core'
import type { SyncCheck } from './types'

export const UPDATE_FILE_NAME = 'labdex-update.json'

/** How often an open app re-checks the link, in milliseconds. */
export const CHECK_INTERVAL_MS = 5 * 60 * 1000

function base64url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/** Turns a normal "share" link into one that downloads the file itself. */
export function directDownloadUrl(link: string): string {
  const url = link.trim()
  if (!url) return url
  // Google Drive: /file/d/<id>/view  or  open?id=<id>
  const gd = url.match(/drive\.google\.com\/(?:file\/d\/([^/?#]+)|open\?id=([^&#]+)|uc\?(?:.*&)?id=([^&#]+))/)
  if (gd) return `https://drive.google.com/uc?export=download&id=${gd[1] ?? gd[2] ?? gd[3]}`
  // Dropbox: force download
  if (/dropbox\.com\//.test(url)) {
    const u = url.replace(/([?&])dl=0/, '$1dl=1')
    return /[?&]dl=1/.test(u) ? u : `${u}${u.includes('?') ? '&' : '?'}dl=1`
  }
  // OneDrive personal / SharePoint share links → shares API
  if (/(1drv\.ms|onedrive\.live\.com|sharepoint\.com)/.test(url) && !/download/.test(url)) return `https://api.onedrive.com/v1.0/shares/u!${base64url(url)}/root/content`
  // GitHub file page → raw
  const gh = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/)
  if (gh) return `https://raw.githubusercontent.com/${gh[1]}/${gh[2]}/${gh[3]}`
  return url
}

/** Downloads and parses the update file. `fetchText` is the platform's HTTP GET. */
export async function fetchPackage(link: string, fetchText: (url: string) => Promise<string>): Promise<UpdatePackage> {
  if (!/^https:\/\//i.test(link.trim())) throw new Error('The update link must start with https://')
  const text = await fetchText(directDownloadUrl(link))
  if (/^\s*</.test(text)) throw new Error('The link opened a web page, not the update file. Use a direct or public share link.')
  return parsePackage(text)
}

/** Compares the published file with what this device has. */
export async function checkFeed(link: string, localRevision: number, fetchText: (url: string) => Promise<string>): Promise<{ check: SyncCheck; pkg: UpdatePackage | null }> {
  try {
    const pkg = await fetchPackage(link, fetchText)
    return {
      pkg,
      check: { available: pkg.revision > localRevision, remoteRevision: pkg.revision, publishedAt: pkg.publishedAt, publishedBy: pkg.publishedBy }
    }
  } catch (e) {
    return { pkg: null, check: { available: false, remoteRevision: 0, publishedAt: null, publishedBy: '', error: e instanceof Error ? e.message : String(e) } }
  }
}

/** Standard fetch wrapper with a timeout, usable on desktop (Electron main) and mobile. */
export async function httpGetText(url: string, timeoutMs = 20000): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'Cache-Control': 'no-cache' } })
    if (!res.ok) throw new Error(`Could not download the update (HTTP ${res.status})`)
    return await res.text()
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('Timed out downloading the update. Check the internet connection.')
    throw e
  } finally {
    clearTimeout(timer)
  }
}
