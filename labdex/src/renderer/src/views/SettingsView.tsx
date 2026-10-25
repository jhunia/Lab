import { useState } from 'react'
import { CheckCircle2, Cloud, CloudDownload, CloudOff, Download, FileUp, FolderOpen, Link2, Monitor, Moon, RefreshCw, Send, Sun, Upload } from 'lucide-react'
import type { Snapshot, SyncCheck } from '@shared/types'
import { api, cx, errMsg, relTime } from '../lib/util'
import { useToast } from '../components/Toasts'
import { isCancel, useRequireStaff } from '../components/Identity'

type Theme = 'system' | 'light' | 'dark'

interface Props {
  snap: Snapshot
  update: SyncCheck | null
  checking: boolean
  onCheck: () => void
  onSync: () => void
  onChanged: () => Promise<void>
  onImportCsv: () => void
  onExportCsv: () => void
  theme: Theme
  setTheme: (t: Theme) => void
}

export function SettingsView({ snap, update, checking, onCheck, onSync, onChanged, onImportCsv, onExportCsv, theme, setTheme }: Props) {
  const toast = useToast()
  const requireStaff = useRequireStaff()
  const { sync, cloud } = snap
  const [feed, setFeed] = useState(sync.feedUrl)
  const [url, setUrl] = useState(sync.cloudUrl)
  const [key, setKey] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [publisher, setPublisher] = useState(() => {
    try {
      return localStorage.getItem('labdex.publisher') ?? ''
    } catch {
      return ''
    }
  })

  const reconnect = async () => {
    setConnecting(true)
    try {
      const r = await api.reconnectLabCloud()
      await onChanged()
      toast('ok', 'Connected to the lab cloud', r.staff ? `${r.staff} staff on the list` : 'The staff list is empty — add yourself as the first Senior under Staff')
    } catch (e) {
      toast('error', 'Could not connect', errMsg(e))
    } finally {
      setConnecting(false)
    }
  }

  const connect = async () => {
    setConnecting(true)
    try {
      await requireStaff('SENIOR', 'connect to a different cloud')
      const r = await api.setCloud({ url, anonKey: key })
      setKey('')
      await onChanged()
      toast('ok', 'Connected to the cloud', r.staff ? `${r.staff} staff on the list` : 'The staff list is empty — add yourself as the first Senior under Staff')
    } catch (e) {
      if (!isCancel(e)) toast('error', 'Could not connect', errMsg(e))
    } finally {
      setConnecting(false)
    }
  }

  const pause = async () => {
    try {
      await requireStaff('SENIOR', 'pause the cloud on this computer')
      await api.setCloud(null)
      await onChanged()
      toast('ok', 'Cloud paused', 'Nothing was deleted — click “Reconnect to the lab cloud” to carry on')
    } catch (e) {
      if (!isCancel(e)) toast('error', 'Something went wrong', errMsg(e))
    }
  }

  const publish = async () => {
    try {
      localStorage.setItem('labdex.publisher', publisher)
    } catch {
      /* non-essential */
    }
    try {
      const who = await requireStaff('SENIOR', 'publish an update')
      const where = await api.publishUpdate(publisher || who?.name || '')
      if (!where) return
      await onChanged()
      toast('ok', 'Update published', cloud.connected ? 'Every device will be told within a minute' : where)
    } catch (e) {
      if (!isCancel(e)) toast('error', 'Publish failed', errMsg(e))
    }
  }

  const openFile = async () => {
    try {
      const r = await api.openUpdateFile()
      if (!r) return
      await onChanged()
      toast('ok', 'Update applied', `${r.tests} tests`)
    } catch (e) {
      toast('error', 'Could not open update', errMsg(e))
    }
  }

  return (
    <div className="settings">
      <div className="toolbar-title">
        <h1>Settings</h1>
        <span className="muted small">Cloud connection, updates and data</span>
      </div>

      <section className="set-card">
        <header>
          {cloud.connected ? <Cloud size={18} /> : <CloudOff size={18} />}
          <h3>Cloud (Supabase)</h3>
          <span className={cx('role-badge', cloud.connected ? 'role-editor' : 'role-viewer')}>{cloud.connected ? 'Connected' : 'Not connected'}</span>
        </header>
        {cloud.connected ? (
          <>
            <p className="muted">
              The staff list, published tests and the sample log are shared through <span className="mono">{sync.cloudUrl.replace('https://', '')}</span>. LabDex syncs every minute and whenever the window is focused.
            </p>
            <div className="sync-status">
              <span>Key {sync.cloudKey}</span>
              {cloud.lastSyncAt && <span>Last sync {relTime(cloud.lastSyncAt)}</span>}
              {cloud.error ? <span className="err-text">{cloud.error}</span> : <span className="ok-text"><CheckCircle2 size={13} /> Working</span>}
            </div>
            <div className="set-row">
              <button className="btn" onClick={() => api.syncTeam().then(onChanged)}>
                <RefreshCw size={14} /> Sync now
              </button>
              <button className="btn btn-ghost" onClick={pause}>
                Pause cloud (Senior)
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">This computer isn’t sharing with the team. Sample logs stay here until you reconnect.</p>
            <div className="set-row">
              <button className="btn btn-primary" disabled={connecting} onClick={reconnect}>
                <Cloud size={14} /> {connecting ? 'Connecting…' : 'Reconnect to the lab cloud'}
              </button>
            </div>
          </>
        )}
        <details className="advanced">
          <summary className="muted">Use a different cloud project (Senior)…</summary>
          <>
            <ol className="steps">
              <li>
                In Supabase → <b>SQL Editor</b>, run the file <code>supabase/schema.sql</code> once.
              </li>
              <li>
                In <b>Project Settings → API</b>, copy the <b>Project URL</b> and the <b>anon / publishable</b> key (never the service_role / secret key).
              </li>
              <li>Paste them here and connect. Do the same on every computer and phone.</li>
            </ol>
            <div className="set-row">
              <div className="search feed-input">
                <Link2 size={15} />
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://abcd1234.supabase.co" />
              </div>
            </div>
            <div className="set-row">
              <div className="search feed-input">
                <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="anon / publishable key" />
              </div>
              <button className="btn btn-primary" disabled={connecting || !url.trim() || !key.trim()} onClick={connect}>
                <Cloud size={14} /> {connecting ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </>
        </details>
      </section>

      <section className="set-card">
        <header>
          <CloudDownload size={18} />
          <h3>Receive test updates</h3>
          {update?.available && <span className="update-dot">Update available</span>}
        </header>
        {cloud.connected ? (
          <p className="muted">Published updates come from the cloud automatically. You’ll see “Update available” and a notification.</p>
        ) : (
          <>
            <p className="muted">No cloud yet? Paste the share link of a published update file (OneDrive, Google Drive, Dropbox…).</p>
            <div className="set-row">
              <div className="search feed-input">
                <Link2 size={15} />
                <input value={feed} onChange={(e) => setFeed(e.target.value)} placeholder="https://1drv.ms/u/s!…  or  https://drive.google.com/file/d/…" />
              </div>
              <button className="btn" disabled={feed === sync.feedUrl} onClick={() => api.setSyncSettings({ feedUrl: feed.trim() }).then(onChanged).then(onCheck)}>
                Save link
              </button>
            </div>
          </>
        )}
        <div className="set-row">
          <button className="btn" disabled={(!cloud.connected && !sync.feedUrl) || checking} onClick={onCheck}>
            <RefreshCw size={14} className={checking ? 'spin' : undefined} /> Check now
          </button>
          <span className="sync-status">
            <span>
              This computer: <b className="mono">{snap.revision ? new Date(snap.revision).toLocaleString() : 'local data only'}</b>
            </span>
            {sync.lastCheckedAt && <span>checked {relTime(sync.lastCheckedAt)}</span>}
            {update?.error && <span className="err-text">{update.error}</span>}
            {update && !update.error && !update.available && (
              <span className="ok-text">
                <CheckCircle2 size={13} /> Up to date
              </span>
            )}
          </span>
        </div>
        {update?.available && (
          <div className="update-callout">
            <div>
              <strong>New update from {update.publishedBy}</strong>
              <span className="muted"> · published {update.publishedAt ? relTime(update.publishedAt) : ''}</span>
              <p className="field-hint">Syncing replaces the tests on this computer with the published version.</p>
            </div>
            <button className="btn btn-primary" onClick={onSync}>
              <Download size={14} /> Sync now
            </button>
          </div>
        )}
        {!cloud.connected && (
          <div className="set-row">
            <button className="btn btn-ghost" onClick={openFile}>
              <FileUp size={14} /> Open an update file…
            </button>
            <span className="field-hint">For files received by email, WhatsApp or USB.</span>
          </div>
        )}
      </section>

      <section className="set-card">
        <header>
          <Send size={18} />
          <h3>Publish test changes (Seniors)</h3>
        </header>
        <p className="muted">
          {cloud.connected
            ? 'After editing tests, publish so every device gets them. Each published version is kept in the cloud.'
            : 'After editing tests, publish an update file and save it over the same file in your shared OneDrive / Google Drive folder.'}
        </p>
        <div className="set-row">
          <input className="input publisher-input" placeholder="Name shown to staff (optional)" value={publisher} onChange={(e) => setPublisher(e.target.value)} />
          <button className="btn btn-primary" onClick={publish}>
            <Upload size={14} /> Publish update
          </button>
        </div>
      </section>

      <section className="set-card">
        <header>
          <FolderOpen size={18} />
          <h3>Data &amp; appearance</h3>
        </header>
        <div className="set-row">
          <button className="btn" onClick={onImportCsv}>
            <Upload size={14} /> Import CSV
          </button>
          <button className="btn" onClick={onExportCsv}>
            <Download size={14} /> Export CSV
          </button>
          <button className="btn btn-ghost" onClick={() => void api.openDataFolder()} title={snap.dataPath}>
            <FolderOpen size={14} /> Open data folder
          </button>
          <span className="spacer" />
          <div className="segmented" role="radiogroup" aria-label="Theme">
            {(
              [
                ['light', Sun, 'Light'],
                ['system', Monitor, 'System'],
                ['dark', Moon, 'Dark']
              ] as const
            ).map(([m, Icon, label]) => (
              <button key={m} className={cx(theme === m && 'active')} onClick={() => setTheme(m)}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
