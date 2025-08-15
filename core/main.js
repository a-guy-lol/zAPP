const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const autoUpdater = require('./auto-updater');
const discordRPC = require('./discord-rpc');
const hydrogenAPI = require('./hydrogen-api');
const zexiumAPI = require('./zexium-api');
const dataManager = require('./data-manager');
const scriptHub = require('./script-hub');

let mainWindow;
let isQuitting = false;

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
  zexiumAPI.initialize();
  dataManager.initialize();
  scriptHub.initialize();
}

app.on('before-quit', (event) => {
  if (isQuitting) {
    return;
  }
  event.preventDefault();

  if (mainWindow && !mainWindow.isDestroyed()) {
    ipcMain.once('final-save-complete', () => {
      isQuitting = true;
      discordRPC.shutdown();
      zexiumAPI.shutdown();
      app.quit();
    });
    mainWindow.webContents.send('request-final-save');
  } else {
    isQuitting = true;
    discordRPC.shutdown();
    zexiumAPI.shutdown();
    app.quit();
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
