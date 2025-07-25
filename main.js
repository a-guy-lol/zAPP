const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const fetch = require('node-fetch');
const { spawn } = require('child_process');
const DiscordRPC = require('discord-rpc');

const clientId = '1385844569052151944';
const rpc = new DiscordRPC.Client({ transport: 'ipc' });
let rpcStartTime = new Date();
let presenceUpdateInterval;

let mainWindow;
let isQuitting = false;
let currentActiveScriptTabName = 'No Script Open';
let isHydrogenConnected = false;

const DATA_DIR = path.join(os.homedir(), 'Documents', 'zexonData');
const DATA_FILE = path.join(DATA_DIR, 'zexon_app_data.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: true,
    show: false,
    icon: path.join(__dirname, 'zexon-icon.icns'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('src/main.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    setupDiscordRPC();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function setDiscordActivity(activityDetails = {}) {
    if (!rpc || !mainWindow) {
        return;
    }

    let stateText = '';
    if (isHydrogenConnected) {
        stateText = 'Connected to Roblox';
    } else {
        stateText = 'Disconnected';
    }

    const activity = {
        details: `Editing ${currentActiveScriptTabName}.lua`,
        state: stateText,
        startTimestamp: rpcStartTime,
        largeImageText: 'Zexon Editor',
        largeImageKey: 'zexon_icon',
        instance: false,
    };

    if (isHydrogenConnected) {
        activity.smallImageKey = 'roblox-icon';
        activity.smallImageText = 'Connected';
    }

    try {
        await rpc.setActivity({ ...activity, ...activityDetails });
    } catch (error) {
        console.error('Failed to set Discord Rich Presence:', error);
    }
}

function setupDiscordRPC() {
    rpc.on('ready', () => {
        setDiscordActivity();
        presenceUpdateInterval = setInterval(() => {
            setDiscordActivity();
        }, 15 * 1000);
    });

    rpc.on('disconnected', () => {
        clearInterval(presenceUpdateInterval);
    });

    rpc.login({ clientId })
        .catch(error => {
            console.error('Failed to connect to Discord Rich Presence:', error);
        });
}

ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('close-window', () => {
  app.quit();
});

ipcMain.on('open-signup-link', () => {
  shell.openExternal('https://api.zexon.workers.dev/');
});

ipcMain.handle('login', async (event, credentials) => {
    const { username, password } = credentials;
    return { success: true, message: 'Login successful!' };
});

ipcMain.handle('execute-script', async (event, scriptContent) => {
  const START_PORT = 6969;
  const END_PORT = 7069;
  let serverPort = null;

  setDiscordActivity({ details: 'Executing a script' });

  for (let port = START_PORT; port <= END_PORT; port++) {
      try {
          const res = await fetch(`http://127.0.0.1:${port}/secret`, { method: 'GET', timeout: 200 });
          if (res.ok && await res.text() === '0xdeadbeef') {
              serverPort = port;
              break;
          }
      } catch (e) { }
  }

  if (!serverPort) {
      setDiscordActivity({ details: `Editing ${currentActiveScriptTabName}.lua` });
      return { success: false, message: `Could not locate HTTP server on ports ${START_PORT}-${END_PORT}.` };
  }

  try {
      const postUrl = `http://127.0.0.1:${serverPort}/execute`;
      const response = await fetch(postUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: scriptContent
      });

      if (response.ok) {
          const resultText = await response.text();
          setDiscordActivity({ details: `Editing ${currentActiveScriptTabName}.lua` });
          return { success: true, message: `Script submitted successfully: ${resultText}` };
      } else {
          const errorText = await response.text();
          setDiscordActivity({ details: `Editing ${currentActiveScriptTabName}.lua` });
          return { success: false, message: `HTTP ${response.status}: ${errorText}` };
      }
  } catch (error) {
      setDiscordActivity({ details: `Editing ${currentActiveScriptTabName}.lua` });
      return { success: false, message: error.message };
  }
});

ipcMain.handle('check-connection', async () => {
  const START_PORT = 6969;
  const END_PORT = 7069;
  let connectedNow = false;
  for (let port = START_PORT; port <= END_PORT; port++) {
      try {
          const res = await fetch(`http://127.0.0.1:${port}/secret`, { method: 'GET', timeout: 200 });
          if (res.ok && await res.text() === '0xdeadbeef') {
              connectedNow = true;
              break;
          }
      } catch (e) { }
  }
  
  if (connectedNow !== isHydrogenConnected) {
      isHydrogenConnected = connectedNow;
      setDiscordActivity();
  }
  return connectedNow;
});

ipcMain.on('update-active-script-name', (event, scriptName) => {
    if (currentActiveScriptTabName !== scriptName) {
        currentActiveScriptTabName = scriptName;
        setDiscordActivity();
    }
});

ipcMain.handle('load-state', async () => {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return { success: true, data: null };
        }
        const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
        const data = JSON.parse(fileContent);
        return { success: true, data };
    } catch (error) {
        console.error('Failed to load state:', error.message);
        return { success: false, error: error.message, data: null };
    }
});

ipcMain.handle('save-state', async (event, dataToSave) => {
    try {
        const jsonString = JSON.stringify(dataToSave, null, 4);
        fs.writeFileSync(DATA_FILE, jsonString, 'utf8');
        return { success: true, message: 'Data saved successfully' };
    } catch (error) {
        console.error('Failed to save state:', error.message);
        return { success: false, error: error.message };
    }
});

app.on('before-quit', (event) => {
    if (isQuitting) {
        return;
    }
    event.preventDefault();

    if (mainWindow && !mainWindow.isDestroyed()) {
        ipcMain.once('final-save-complete', () => {
            isQuitting = true;
            if (rpc) {
                clearInterval(presenceUpdateInterval);
                rpc.destroy(); 
            }
            app.quit();
        });
        mainWindow.webContents.send('request-final-save');
    } else {
        isQuitting = true;
        if (rpc) {
            clearInterval(presenceUpdateInterval);
            rpc.destroy();
        }
        app.quit();
    }
});

app.whenReady().then(() => {
  createWindow();
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
