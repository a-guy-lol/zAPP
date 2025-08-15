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
  executeHubScript: (scriptPath, useZexiumAPI, savedKey) => ipcRenderer.invoke('execute-hub-script', scriptPath, useZexiumAPI, savedKey),
  
  toggleZexiumAPI: (isEnabled) => ipcRenderer.invoke('toggle-zexium-api', isEnabled),
  getZexiumAPIStatus: () => ipcRenderer.invoke('get-zexium-api-status'),
  executeScriptZexium: (scriptContent) => ipcRenderer.invoke('execute-script-zexium', scriptContent),
  
  saveScriptSettings: (scriptName, settings) => ipcRenderer.invoke('save-script-settings', scriptName, settings),
  loadScriptSettings: (scriptName) => ipcRenderer.invoke('load-script-settings', scriptName),
  executeOnJoinScripts: () => ipcRenderer.invoke('execute-on-join-scripts'),
});
