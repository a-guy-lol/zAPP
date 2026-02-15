const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  openSignupLink: () => ipcRenderer.send('open-signup-link'),
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  checkConnection: () => ipcRenderer.invoke('check-connection'),
  executeScript: (scriptContent) => ipcRenderer.invoke('execute-script', scriptContent),
  loadState: () => ipcRenderer.invoke('load-state'),
  saveState: (data) => ipcRenderer.invoke('save-state', data),
  loadUsername: () => ipcRenderer.invoke('load-username'),
  saveUsername: (username) => ipcRenderer.invoke('save-username', username),
  onRequestFinalSave: (callback) => ipcRenderer.on('request-final-save', callback),
  notifyFinalSaveComplete: () => ipcRenderer.send('final-save-complete'),
  updateActiveScriptName: (scriptName) => ipcRenderer.send('update-active-script-name', scriptName),
  getChangelog: () => ipcRenderer.invoke('get-changelog'),
  clearAppData: () => ipcRenderer.invoke('clear-app-data'),
  setWindowOpacity: (opacity) => ipcRenderer.invoke('set-window-opacity', opacity),
  toggleDiscordRpc: (isEnabled) => ipcRenderer.invoke('toggle-discord-rpc', isEnabled),
  getDiscordRpcStatus: () => ipcRenderer.invoke('get-discord-rpc-status'),
  
  isDevelopment: () => ipcRenderer.invoke('is-development'),
  
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  checkForUpdatesForce: () => ipcRenderer.invoke('check-for-updates-force'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onUpdateError: (callback) => ipcRenderer.on('update-error', callback),
  onUpdateLog: (callback) => ipcRenderer.on('update-log', callback),
  
  getScripts: () => ipcRenderer.invoke('get-scripts'),
  executeHubScript: (scriptPath, savedKey) => ipcRenderer.invoke('execute-hub-script', scriptPath, savedKey),
  setSelectedExecutor: (executor) => ipcRenderer.invoke('set-selected-executor', executor),
  getSelectedExecutor: () => ipcRenderer.invoke('get-selected-executor'),
  consoleSetConfig: (config) => ipcRenderer.invoke('console-set-config', config),
  consoleGetLogs: (sinceSeq) => ipcRenderer.invoke('console-get-logs', sinceSeq),
  consoleOpenAutoexecPath: (executor) => ipcRenderer.invoke('console-open-autoexec-path', executor),
  consoleClearLogs: () => ipcRenderer.invoke('console-clear-logs'),
  syncAutoexecuteScripts: (payload) => ipcRenderer.invoke('sync-autoexecute-scripts', payload),
  
  saveScriptSettings: (scriptName, settings) => ipcRenderer.invoke('save-script-settings', scriptName, settings),
  loadScriptSettings: (scriptName) => ipcRenderer.invoke('load-script-settings', scriptName),
});
