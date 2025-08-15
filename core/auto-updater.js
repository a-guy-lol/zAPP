const { autoUpdater } = require('electron-updater');
const { ipcMain, app } = require('electron');

let mainWindow = null;

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'a-guy-lol',
  repo: 'zAPP'
});

autoUpdater.autoDownload = false;

autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-log', 'Checking for update...');
  }
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available.', info);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-log', `Update available: ${JSON.stringify(info)}`);
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available.', info);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-log', `Update not available: ${JSON.stringify(info)}`);
  }
});

autoUpdater.on('error', (err) => {
  console.log('Error in auto-updater: ' + err);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-log', `Auto-updater error: ${err.message}`);
    mainWindow.webContents.send('update-error', { error: err.message });
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  console.log(log_message);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-log', log_message);
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-log', `Update downloaded: ${JSON.stringify(info)}`);
    mainWindow.webContents.send('update-downloaded', info);
  }
});

ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    console.log('Development mode: Updates only available in packaged app');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-log', 'Development mode: Updates only available in packaged app');
    }
    return { success: false, message: 'Updates only available in packaged app' };
  }
  try {
    console.log('Checking for updates...');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-log', 'Starting update check...');
    }
    const result = await autoUpdater.checkForUpdates();
    console.log('Update check result:', result);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-log', `Update check result: ${JSON.stringify(result)}`);
    }
    return { success: true, updateInfo: result };
  } catch (error) {
    console.error('Update check error:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-log', `Update check error: ${error.message}`);
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-for-updates-force', async () => {
  try {
    console.log('Force checking for updates (ignoring packaging status)...');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-log', 'Force checking for updates...');
    }
    const result = await autoUpdater.checkForUpdates();
    console.log('Force update check result:', result);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-log', `Force update check result: ${JSON.stringify(result)}`);
    }
    return { success: true, updateInfo: result };
  } catch (error) {
    console.error('Force update check error:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-log', `Force update check error: ${error.message}`);
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-update', async () => {
  if (!app.isPackaged) {
    console.log('Development mode: Downloads will fail due to code signing requirements');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-log', 'Development mode: Downloads will fail due to code signing requirements');
    }
    return { success: false, message: 'Downloads only work in packaged, signed apps. Development mode cannot download updates due to security restrictions.' };
  }
  try {
    console.log('Starting update download...');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-log', 'Starting update download...');
    }
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    console.error('Download update error:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-log', `Download update error: ${error.message}`);
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-update', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-log', 'Installing update and restarting...');
  }
  autoUpdater.quitAndInstall();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

function initialize(window) {
  mainWindow = window;
}

function checkForUpdates() {
  autoUpdater.checkForUpdates();
}

module.exports = {
  initialize,
  checkForUpdates
};
