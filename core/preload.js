const { contextBridge, ipcRenderer, clipboard } = require('electron');

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
  getAppDataFileSize: () => ipcRenderer.invoke('get-app-data-file-size'),
  clearAppData: () => ipcRenderer.invoke('clear-app-data'),
  preferencesGetAll: () => ipcRenderer.invoke('preferences-get-all'),
  preferencesSetMany: (updates) => ipcRenderer.invoke('preferences-set-many', updates),
  preferencesSet: (key, value) => ipcRenderer.invoke('preferences-set', key, value),
  preferencesRemove: (key) => ipcRenderer.invoke('preferences-remove', key),
  preferencesClear: () => ipcRenderer.invoke('preferences-clear'),
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
  scriptbloxTrending: () => ipcRenderer.invoke('scriptblox-trending'),
  scriptbloxSearch: (options) => ipcRenderer.invoke('scriptblox-search', options),
  scriptbloxGetScriptContent: (scriptIdentifier) => ipcRenderer.invoke('scriptblox-get-script-content', scriptIdentifier),
  clipboardWriteText: (text) => {
    try {
      if (!clipboard || typeof clipboard.writeText !== 'function') {
        return { success: false, error: 'Clipboard is unavailable.' };
      }
      clipboard.writeText(String(text ?? ''));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  setSelectedExecutor: (executor) => ipcRenderer.invoke('set-selected-executor', executor),
  getSelectedExecutor: () => ipcRenderer.invoke('get-selected-executor'),
  consoleSetConfig: (config) => ipcRenderer.invoke('console-set-config', config),
  consoleGetLogs: (sinceSeq) => ipcRenderer.invoke('console-get-logs', sinceSeq),
  consoleOpenAutoexecPath: (executor) => ipcRenderer.invoke('console-open-autoexec-path', executor),
  consoleClearLogs: () => ipcRenderer.invoke('console-clear-logs'),
  syncAutoexecuteScripts: (payload) => ipcRenderer.invoke('sync-autoexecute-scripts', payload),
  syncScriptHubAutoexecute: (payload) => ipcRenderer.invoke('sync-script-hub-autoexecute', payload),
  
  saveScriptSettings: (scriptRef, settings) => ipcRenderer.invoke('save-script-settings', scriptRef, settings),
  loadScriptSettings: (scriptRef) => ipcRenderer.invoke('load-script-settings', scriptRef),
});
