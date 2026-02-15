const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const autoUpdater = require('./auto-updater');
const discordRPC = require('./discord-rpc');
const hydrogenAPI = require('./hydrogen-api');
const consoleBridge = require('./console-bridge');
const autoexecuteManager = require('./autoexecute-manager');
const dataManager = require('./data-manager');
const scriptHub = require('./script-hub');

let mainWindow;
let isQuitting = false;
let quitSaveTimeout = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: true,
    show: false,
    icon: path.join(__dirname, '..', 'zyron-icon.icns'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'main.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    discordRPC.setup();
    
    setTimeout(() => {
      if (!app.isPackaged) {
        console.log('Development mode - skipping update check');
        return;
      }
      autoUpdater.checkForUpdates();
    }, 3000);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('close-window', () => {
  app.quit();
});

ipcMain.on('set-opacity', (event, opacity) => {
  if (mainWindow) {
    mainWindow.setOpacity(opacity);
  }
});

ipcMain.on('open-signup-link', () => {
});

ipcMain.handle('login', async (event, credentials) => {
  const { username, password } = credentials;
  return { success: true, message: 'Login successful!' };
});

ipcMain.handle('is-development', () => {
  return !app.isPackaged;
});

ipcMain.handle('set-window-opacity', (event, opacity) => {
  if (mainWindow) {
    mainWindow.setOpacity(opacity);
  }
});

function initializeModules() {
  autoUpdater.initialize(mainWindow);
  discordRPC.initialize();
  hydrogenAPI.initialize();
  consoleBridge.initialize(mainWindow);
  autoexecuteManager.initialize();
  dataManager.initialize();
  scriptHub.initialize();
}

function finalizeQuit() {
  if (isQuitting) return;
  isQuitting = true;
  if (quitSaveTimeout) {
    clearTimeout(quitSaveTimeout);
    quitSaveTimeout = null;
  }
  discordRPC.shutdown();
  consoleBridge.shutdown();
  app.quit();
}

app.on('before-quit', (event) => {
  if (isQuitting) {
    return;
  }
  event.preventDefault();

  if (mainWindow && !mainWindow.isDestroyed()) {
    ipcMain.once('final-save-complete', () => {
      finalizeQuit();
    });
    // Never block quit forever if renderer save callback fails.
    quitSaveTimeout = setTimeout(() => {
      console.warn('Final save timed out. Forcing quit.');
      finalizeQuit();
    }, 5000);
    mainWindow.webContents.send('request-final-save');
  } else {
    finalizeQuit();
  }
});

app.whenReady().then(() => {
  createWindow();
  initializeModules();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

module.exports = {
  getMainWindow: () => mainWindow
};
