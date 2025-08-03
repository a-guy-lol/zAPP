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
  onRequestFinalSave: (callback) => ipcRenderer.on('request-final-save', callback),
  notifyFinalSaveComplete: () => ipcRenderer.send('final-save-complete'),
  updateActiveScriptName: (scriptName) => ipcRenderer.send('update-active-script-name', scriptName),
  getChangelog: () => ipcRenderer.invoke('get-changelog'),
  clearAppData: () => ipcRenderer.invoke('clear-app-data'),
  setOpacity: (opacity) => ipcRenderer.send('set-opacity', opacity),
  toggleDiscordRpc: (isEnabled) => ipcRenderer.invoke('toggle-discord-rpc', isEnabled),
  getDiscordRpcStatus: () => ipcRenderer.invoke('get-discord-rpc-status'),
  
  // Auto-updater methods
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Auto-updater events
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  
  // Script Hub methods
  getScripts: () => ipcRenderer.invoke('get-scripts'),
  executeHubScript: (scriptPath) => ipcRenderer.invoke('execute-hub-script', scriptPath),
});
