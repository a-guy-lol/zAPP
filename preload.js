
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
});
