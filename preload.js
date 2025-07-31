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
});
