import { contextBridge, ipcRenderer } from 'electron'
import type { LabDexApi } from '@shared/types'

const api: LabDexApi = {
  getAll: () => ipcRenderer.invoke('tests:all'),
  saveTest: (input) => ipcRenderer.invoke('tests:save', input),
  archiveTest: (id) => ipcRenderer.invoke('tests:archive', id),
  restoreTest: (id) => ipcRenderer.invoke('tests:restore', id),
  deleteTest: (id) => ipcRenderer.invoke('tests:delete', id),
  getHistory: (id) => ipcRenderer.invoke('tests:history', id),
  revertTo: (historyId) => ipcRenderer.invoke('tests:revert', historyId),
  saveContainer: (c) => ipcRenderer.invoke('containers:save', c),
  deleteContainer: (id) => ipcRenderer.invoke('containers:delete', id),
  saveDepartment: (d) => ipcRenderer.invoke('departments:save', d),
  deleteDepartment: (id) => ipcRenderer.invoke('departments:delete', id),
  exportCsv: () => ipcRenderer.invoke('csv:export'),
  importCsv: () => ipcRenderer.invoke('csv:import'),
  openDataFolder: () => ipcRenderer.invoke('app:openDataFolder'),
  setTheme: (mode) => ipcRenderer.send('app:theme', mode),
  publishUpdate: (publishedBy) => ipcRenderer.invoke('sync:publish', publishedBy),
  openUpdateFile: () => ipcRenderer.invoke('sync:openFile'),
  checkForUpdate: () => ipcRenderer.invoke('sync:check'),
  syncNow: () => ipcRenderer.invoke('sync:now'),
  setSyncSettings: (patch) => ipcRenderer.invoke('sync:settings', patch),
  identify: (staffId, pin, minRole, allowProvisional) => ipcRenderer.invoke('staff:identify', staffId, pin, minRole, allowProvisional),
  lockSession: () => ipcRenderer.invoke('staff:lock'),
  saveStaff: (input, newPin) => ipcRenderer.invoke('staff:save', input, newPin),
  changeOwnPin: (staffId, oldPin, newPin) => ipcRenderer.invoke('staff:changePin', staffId, oldPin, newPin),
  setCloud: (cfg) => ipcRenderer.invoke('cloud:set', cfg),
  reconnectLabCloud: () => ipcRenderer.invoke('cloud:reconnect'),
  syncTeam: () => ipcRenderer.invoke('cloud:sync'),
  getLogs: () => ipcRenderer.invoke('logs:all'),
  createLog: (input) => ipcRenderer.invoke('logs:create', input),
  addLogEvent: (logId, status, note) => ipcRenderer.invoke('logs:event', logId, status, note),
  reconfirmUpload: (eventId, pin) => ipcRenderer.invoke('logs:reconfirm', eventId, pin),
  onChanged: (cb) => {
    const handler = () => cb()
    ipcRenderer.on('labdex:changed', handler)
    return () => ipcRenderer.removeListener('labdex:changed', handler)
  }
}

contextBridge.exposeInMainWorld('labdex', api)
