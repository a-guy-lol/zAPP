const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const os = require('os');
const fetch = require('node-fetch');
const { spawn } = require('child_process');
const DiscordRPC = require('discord-rpc');
const WebSocket = require('ws');
const net = require('net');

const clientId = '1385844569052151944';
let rpc = new DiscordRPC.Client({ transport: 'ipc' });
let rpcStartTime = new Date();
let presenceUpdateInterval;

let mainWindow;
let isQuitting = false;
let rpcEnabled = true; // Default to true
let currentActiveScriptTabName = 'No Script Open';
let isHydrogenConnected = false;
let isZexiumAPIEnabled = false;
let zexiumServer = null;
let zexiumPort = null;

const DATA_DIR = path.join(os.homedir(), 'Documents', 'zyronData');
const DATA_FILE = path.join(DATA_DIR, 'zyron_app_data.json');
const HYDROGEN_DIR = path.join(os.homedir(), 'Hydrogen');
const AUTOEXEC_DIR = path.join(HYDROGEN_DIR, 'autoexecute');
const ZEXIUM_API_FILE = path.join(AUTOEXEC_DIR, 'zexiumAPI.lua');

// Configure auto-updater
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'a-guy-lol',
  repo: 'zAPP'
});

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available.', info);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-available', info);
  }
  // Don't automatically download - wait for user confirmation
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available.', info);
});

autoUpdater.on('error', (err) => {
  console.log('Error in auto-updater. ' + err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  console.log(log_message);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-downloaded', info);
  }
});

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
    icon: path.join(__dirname, 'zyron-icon.icns'),
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
    
    // Check for updates when app is ready (wait 3 seconds)
    setTimeout(() => {
      if (!app.isPackaged) {
        console.log('Development mode - skipping update check');
        return;
      }
      autoUpdater.checkForUpdates(); // Changed from checkForUpdatesAndNotify to checkForUpdates
    }, 3000);
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
        details: `✧ Editing ${currentActiveScriptTabName}.lua ✧`,
        state: stateText,
        startTimestamp: rpcStartTime,
        largeImageText: 'Zyron Editor',
        largeImageKey: 'zyron_icon',
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
    if (!rpcEnabled) return;
    
    // If rpc client was destroyed, create a new one
    if (!rpc) {
        rpc = new DiscordRPC.Client({ transport: 'ipc' });
    }

    rpc.on('ready', () => {
        setDiscordActivity();
        if (presenceUpdateInterval) clearInterval(presenceUpdateInterval);
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
            rpc = null; // Set to null on failure to allow re-creation
        });
}

function shutdownDiscordRPC() {
    if (!rpc) return;
    clearInterval(presenceUpdateInterval);
    rpc.destroy().catch(console.error);
    rpc = null; // Destroy and nullify
}

// Zexium API WebSocket Server Functions
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        
        server.listen(port, () => {
            server.once('close', () => {
                resolve(true);
            });
            server.close();
        });
        
        server.on('error', () => {
            resolve(false);
        });
    });
}

async function findAvailablePort(startPort = 5480, endPort = 5490) {
    for (let port = startPort; port <= endPort; port++) {
        if (await isPortAvailable(port)) {
            return port;
        }
    }
    throw new Error(`No available ports found between ${startPort}-${endPort}`);
}

async function startZexiumServer() {
    if (zexiumServer) {
        return { success: true, port: zexiumPort };
    }

    // Helper function to handle execute on join
    async function handleExecuteOnJoin() {
        if (!isZexiumAPIEnabled || !zexiumServer) {
            return;
        }

        try {
            const dataResult = await loadAppData();
            if (!dataResult.success || !dataResult.data || !dataResult.data.scriptSettings) {
                return;
            }

            const scriptsToExecute = [];
            const scriptSettings = dataResult.data.scriptSettings;

            for (const [scriptName, settings] of Object.entries(scriptSettings)) {
                if (settings.executeOnJoin) {
                    const scriptsDir = path.join(__dirname, 'src', 'scripts');
                    const scriptPath = path.join(scriptsDir, scriptName);
                    const luaFile = path.join(scriptPath, 'script.lua');
                    
                    if (fs.existsSync(luaFile)) {
                        let scriptContent;
                        
                        // Handle special case for Sensation
                        if (scriptName === 'Sensation') {
                            if (settings.savedKey && settings.savedKey.trim()) {
                                // Paid version with key
                                scriptContent = `script_key="${settings.savedKey}";
loadstring(game:HttpGet("https://api.luarmor.net/files/v3/loaders/730854e5b6499ee91deb1080e8e12ae3.lua"))()`;
                            } else {
                                // Free version
                                scriptContent = `loadstring(game:HttpGet("https://api.luarmor.net/files/v4/loaders/730854e5b6499ee91deb1080e8e12ae3.lua"))()`;
                            }
                        } else {
                            // Regular script loading
                            scriptContent = fs.readFileSync(luaFile, 'utf-8');
                        }
                        
                        scriptsToExecute.push({
                            name: scriptName,
                            content: scriptContent,
                            key: settings.savedKey || ''
                        });
                    }
                }
            }

            if (scriptsToExecute.length > 0) {
                zexiumServer.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        scriptsToExecute.forEach(script => {
                            const executeMessage = {
                                type: 'execute',
                                script: script.content,
                                scriptName: script.name,
                                key: script.key,
                                timestamp: new Date().toISOString()
                            };
                            client.send(JSON.stringify(executeMessage));
                        });
                    }
                });
                console.log(`Executed ${scriptsToExecute.length} script(s) on join`);
            }
        } catch (error) {
            console.error('Error executing scripts on join:', error);
        }
    }

    try {
        const port = await findAvailablePort();
        zexiumPort = port;
        
        zexiumServer = new WebSocket.Server({ port: port });

        zexiumServer.on('connection', function connection(ws, request) {
            console.log('Zexium client connected');
            
            const welcome = { 
                message: "Connected to Zyron Zexium API",
                port: port,
                server: "Zyron Zexium API"
            };
            ws.send(JSON.stringify(welcome));
            
            ws.on('message', function incoming(data) {
                const message = data.toString();
                console.log('Received from client:', message);
                
                // Handle client messages
                try {
                    const parsedMessage = JSON.parse(message);
                    
                    if (parsedMessage.type === 'request_execute_on_join') {
                        // Client is requesting execute on join scripts
                        handleExecuteOnJoin();
                    }
                } catch (parseError) {
                    // Handle simple text messages
                    if (message.trim().toLowerCase() === 'hi') {
                        const response = { 
                            message: "Hello from Zyron!",
                            port: port,
                            timestamp: new Date().toISOString()
                        };
                        ws.send(JSON.stringify(response));
                    }
                }
            });
            
            ws.on('close', function close() {
                console.log('Zexium client disconnected');
            });
            
            ws.on('error', function error(err) {
                console.error('Zexium WebSocket error:', err);
            });
        });

        zexiumServer.on('error', function error(err) {
            console.error('Zexium server error:', err);
            zexiumServer = null;
            zexiumPort = null;
        });

        console.log(`Zexium API server started on port ${port}`);
        return { success: true, port: port };
    } catch (error) {
        console.error('Failed to start Zexium server:', error);
        zexiumServer = null;
        zexiumPort = null;
        return { success: false, error: error.message };
    }
}

function stopZexiumServer() {
    if (zexiumServer) {
        zexiumServer.close();
        zexiumServer = null;
        zexiumPort = null;
        console.log('Zexium API server stopped');
    }
}

function createZexiumAPIFile() {
    try {
        // Ensure Hydrogen directory exists
        if (!fs.existsSync(HYDROGEN_DIR)) {
            fs.mkdirSync(HYDROGEN_DIR, { recursive: true });
        }
        
        // Ensure autoexecute directory exists
        if (!fs.existsSync(AUTOEXEC_DIR)) {
            fs.mkdirSync(AUTOEXEC_DIR, { recursive: true });
        }

        // Read the client.lua content from attachments
        const clientCode = `local ws = nil
local isConnected = false
local BASE_PORT = 5480 
local hasExecutedOnJoin = false
local currentGameId = nil

local function onMessage(message)
    local success, data = pcall(function()
        return game:GetService("HttpService"):JSONDecode(message)
    end)
    
    if success and data then
        if data.type == "execute" and data.script then
            -- Execute the script
            local executeSuccess, executeError = pcall(function()
                loadstring(data.script)()
            end)
            
            if not executeSuccess then
                warn("Zexium API: Script execution failed:", executeError)
            end
        end
    end
end

local function onClose()
    isConnected = false
    hasExecutedOnJoin = false
    currentGameId = nil
    ws = nil
end

local function discoverServer()
    for port = BASE_PORT, BASE_PORT + 10 do
        local url = "ws://localhost:" .. port
        
        local success, result = pcall(function()
            return WebSocket.connect(url)
        end)
        
        if success then
            return result, url
        end
        
        wait(0.1)
    end
    
    return nil, nil
end

local function disconnectWebSocket()
    if ws and isConnected then
        local success, error = pcall(function()
            ws:Close()
        end)
        if not success then
            warn("Zexium API: Error closing WebSocket:", error)
        end
    end
    isConnected = false
    ws = nil
    hasExecutedOnJoin = false
    currentGameId = nil
end

local function handleGameJoin()
    local newGameId = game.GameId
    if isConnected and (newGameId ~= currentGameId) and not hasExecutedOnJoin then
        hasExecutedOnJoin = true
        currentGameId = newGameId
        -- Request execute on join scripts
        local requestMessage = {
            type = "request_execute_on_join",
            gameId = newGameId,
            timestamp = tick()
        }
        if ws then
            ws:Send(game:GetService("HttpService"):JSONEncode(requestMessage))
        end
    end
end

local serverWs, serverUrl = discoverServer()

if serverWs then
    ws = serverWs
    isConnected = true
    
    ws.OnMessage:Connect(onMessage)
    ws.OnClose:Connect(onClose)
    
    ws:Send("hi")
    
    local Players = game:GetService("Players")
    
    -- Handle execute on join when player joins a game
    if Players.LocalPlayer then
        currentGameId = game.GameId
        handleGameJoin()
    end
    
    local function monitorGameChanges()
        spawn(function()
            while isConnected and ws do
                wait(2)
                
                -- Check if game changed (player left and joined another)
                local newGameId = game.GameId
                if newGameId ~= currentGameId then
                    hasExecutedOnJoin = false
                    handleGameJoin()
                end
                
                -- Check if player disconnected
                if not Players.LocalPlayer or not game:IsLoaded() then
                    disconnectWebSocket()
                    break
                end
            end
        end)
    end
    
    monitorGameChanges()
    
    -- Disconnect when player leaves the game
    Players.PlayerRemoving:Connect(function(player)
        if player == Players.LocalPlayer then
            disconnectWebSocket()
        end
    end)
end`;

        fs.writeFileSync(ZEXIUM_API_FILE, clientCode, 'utf8');
        return { success: true };
    } catch (error) {
        console.error('Failed to create Zexium API file:', error);
        return { success: false, error: error.message };
    }
}

function deleteZexiumAPIFile() {
    try {
        if (fs.existsSync(ZEXIUM_API_FILE)) {
            fs.unlinkSync(ZEXIUM_API_FILE);
        }
        return { success: true };
    } catch (error) {
        console.error('Failed to delete Zexium API file:', error);
        return { success: false, error: error.message };
    }
}

ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('close-window', () => {
  app.quit();
});

ipcMain.handle('toggle-discord-rpc', (event, isEnabled) => {
    rpcEnabled = isEnabled;
    if (isEnabled) {
        setupDiscordRPC();
    } else {
        shutdownDiscordRPC();
    }
    return rpcEnabled;
});

ipcMain.handle('get-discord-rpc-status', () => {
    return rpcEnabled;
});

ipcMain.on('open-signup-link', () => {
  
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
      return { success: false, message: `Could not connect to Hydrogen. Try restarting Hydrogen or Roblox.` };
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

ipcMain.handle('get-changelog', async () => {
    try {
        const changelogPath = path.join(__dirname, 'changelog.json');
        const data = fs.readFileSync(changelogPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to read changelog:', error);
        return null;
    }
});

ipcMain.handle('clear-app-data', async () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            fs.unlinkSync(DATA_FILE);
        }
        // Optionally, could add more data clearing logic here
        return { success: true };
    } catch (error) {
        console.error('Failed to clear app data:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.on('set-opacity', (event, opacity) => {
    if (mainWindow) {
        mainWindow.setOpacity(opacity);
    }
});

ipcMain.handle('load-state', async () => {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return { success: true, data: null };
        }
        const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
        const data = JSON.parse(fileContent);
        
        // If data is an array (old format), convert it
        if (Array.isArray(data)) {
            return { success: true, data };
        }
        
        // Return just the tabs data from the new format
        return { success: true, data: data.tabs || null };
    } catch (error) {
        console.error('Failed to load state:', error.message);
        return { success: false, error: error.message, data: null };
    }
});

ipcMain.handle('save-state', async (event, tabsData) => {
    try {
        // Load existing data to preserve script settings
        const existingDataResult = await loadAppData();
        let existingData = existingDataResult.data || {};
        
        // Update the tabs data while preserving other data
        existingData.tabs = tabsData;
        
        const jsonString = JSON.stringify(existingData, null, 4);
        fs.writeFileSync(DATA_FILE, jsonString, 'utf8');
        return { success: true, message: 'Data saved successfully' };
    } catch (error) {
        console.error('Failed to save state:', error.message);
        return { success: false, error: error.message };
    }
});

// Auto-updater IPC handlers
ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) {
        return { success: false, message: 'Updates only available in packaged app' };
    }
    try {
        const result = await autoUpdater.checkForUpdates();
        return { success: true, updateInfo: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('download-update', async () => {
    if (!app.isPackaged) {
        return { success: false, message: 'Updates only available in packaged app' };
    }
    try {
        await autoUpdater.downloadUpdate();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall();
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

// Zexium API IPC handlers
ipcMain.handle('toggle-zexium-api', async (event, isEnabled) => {
    isZexiumAPIEnabled = isEnabled;
    
    if (isEnabled) {
        const createResult = createZexiumAPIFile();
        if (!createResult.success) {
            return { success: false, error: createResult.error };
        }
        
        const serverResult = await startZexiumServer();
        return serverResult;
    } else {
        stopZexiumServer();
        const deleteResult = deleteZexiumAPIFile();
        return deleteResult;
    }
});

ipcMain.handle('get-zexium-api-status', () => {
    let clientConnected = false;
    if (zexiumServer) {
        // Check if any clients are connected
        zexiumServer.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                clientConnected = true;
            }
        });
    }
    
    return {
        enabled: isZexiumAPIEnabled,
        serverRunning: zexiumServer !== null,
        clientConnected: clientConnected,
        port: zexiumPort
    };
});

// Execute script through Zexium API
async function executeScriptThroughZexium(scriptContent) {
    if (!zexiumServer || !isZexiumAPIEnabled) {
        return { success: false, message: 'Zexium API is not enabled or server not running' };
    }

    return new Promise((resolve) => {
        let resolved = false;
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve({ success: false, message: 'No Zexium client connected or timeout' });
            }
        }, 5000);

        // Send script to all connected clients
        let clientFound = false;
        zexiumServer.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                clientFound = true;
                const executeMessage = {
                    type: 'execute',
                    script: scriptContent,
                    timestamp: new Date().toISOString()
                };
                client.send(JSON.stringify(executeMessage));
            }
        });

        if (clientFound) {
            clearTimeout(timeout);
            if (!resolved) {
                resolved = true;
                resolve({ success: true, message: 'Script sent to Zexium client' });
            }
        } else {
            clearTimeout(timeout);
            if (!resolved) {
                resolved = true;
                resolve({ success: false, message: 'No Zexium client connected' });
            }
        }
    });
}

ipcMain.handle('execute-script-zexium', async (event, scriptContent) => {
    return await executeScriptThroughZexium(scriptContent);
});

// Save script settings (keys, execute on join)
ipcMain.handle('save-script-settings', async (event, scriptName, settings) => {
    try {
        const dataResult = await loadAppData();
        let data = dataResult.data || {};
        
        if (!data.scriptSettings) {
            data.scriptSettings = {};
        }
        
        data.scriptSettings[scriptName] = settings;
        
        const saveResult = await saveAppData(data);
        return saveResult;
    } catch (error) {
        console.error('Failed to save script settings:', error);
        return { success: false, error: error.message };
    }
});

// Load script settings
ipcMain.handle('load-script-settings', async (event, scriptName) => {
    try {
        const dataResult = await loadAppData();
        if (dataResult.success && dataResult.data && dataResult.data.scriptSettings) {
            return { 
                success: true, 
                settings: dataResult.data.scriptSettings[scriptName] || {} 
            };
        }
        return { success: true, settings: {} };
    } catch (error) {
        console.error('Failed to load script settings:', error);
        return { success: false, error: error.message };
    }
});

// Helper functions for data handling
async function loadAppData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return { success: true, data: null };
        }
        const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
        const data = JSON.parse(fileContent);
        return { success: true, data };
    } catch (error) {
        console.error('Failed to load app data:', error.message);
        return { success: false, error: error.message, data: null };
    }
}

async function saveAppData(dataToSave) {
    try {
        const jsonString = JSON.stringify(dataToSave, null, 4);
        fs.writeFileSync(DATA_FILE, jsonString, 'utf8');
        return { success: true, message: 'Data saved successfully' };
    } catch (error) {
        console.error('Failed to save app data:', error.message);
        return { success: false, error: error.message };
    }
}

// Execute scripts on join functionality
ipcMain.handle('execute-on-join-scripts', async () => {
    if (!isZexiumAPIEnabled || !zexiumServer) {
        return { success: false, message: 'Zexium API not enabled or server not running' };
    }

    try {
        // Load all script settings to find scripts with executeOnJoin enabled
        const dataResult = await loadAppData();
        if (!dataResult.success || !dataResult.data || !dataResult.data.scriptSettings) {
            return { success: true, message: 'No scripts to execute on join' };
        }

        const scriptsToExecute = [];
        const scriptSettings = dataResult.data.scriptSettings;

        for (const [scriptName, settings] of Object.entries(scriptSettings)) {
            if (settings.executeOnJoin) {
                // Find the script
                const scriptsDir = path.join(__dirname, 'src', 'scripts');
                const scriptPath = path.join(scriptsDir, scriptName);
                const luaFile = path.join(scriptPath, 'script.lua');
                
                if (fs.existsSync(luaFile)) {
                    let scriptContent;
                    
                    // Handle special case for Sensation
                    if (scriptName === 'Sensation') {
                        if (settings.savedKey && settings.savedKey.trim()) {
                            // Paid version with key
                            scriptContent = `script_key="${settings.savedKey}";
loadstring(game:HttpGet("https://api.luarmor.net/files/v3/loaders/730854e5b6499ee91deb1080e8e12ae3.lua"))()`;
                        } else {
                            // Free version
                            scriptContent = `loadstring(game:HttpGet("https://api.luarmor.net/files/v4/loaders/730854e5b6499ee91deb1080e8e12ae3.lua"))()`;
                        }
                    } else {
                        // Regular script loading
                        scriptContent = fs.readFileSync(luaFile, 'utf-8');
                    }
                    
                    scriptsToExecute.push({
                        name: scriptName,
                        content: scriptContent,
                        key: settings.savedKey || ''
                    });
                }
            }
        }

        if (scriptsToExecute.length === 0) {
            return { success: true, message: 'No scripts configured for execute on join' };
        }

        // Send all scripts to connected clients
        let clientsFound = false;
        zexiumServer.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                clientsFound = true;
                scriptsToExecute.forEach(script => {
                    const executeMessage = {
                        type: 'execute',
                        script: script.content,
                        scriptName: script.name,
                        key: script.key,
                        timestamp: new Date().toISOString()
                    };
                    client.send(JSON.stringify(executeMessage));
                });
            }
        });

        if (clientsFound) {
            return { 
                success: true, 
                message: `Executed ${scriptsToExecute.length} script(s) on join`,
                scriptsCount: scriptsToExecute.length
            };
        } else {
            return { success: false, message: 'No Zexium client connected' };
        }
    } catch (error) {
        console.error('Error executing scripts on join:', error);
        return { success: false, error: error.message };
    }
});

// Script Hub functionality
ipcMain.handle('get-scripts', async () => {
    try {
        const scriptsDir = path.join(__dirname, 'src', 'scripts');
        if (!fs.existsSync(scriptsDir)) {
            return [];
        }
        
        const scriptFolders = fs.readdirSync(scriptsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        const scripts = [];
        
        for (const folderName of scriptFolders) {
            const scriptPath = path.join(scriptsDir, folderName);
            const script = {
                name: folderName,
                path: scriptPath,
                description: '',
                thumbnail: null,
                type: 'free', // default type
                author: '',
                supportsExecuteOnJoin: true
            };
            
            // Read config.json if it exists
            const configPath = path.join(scriptPath, 'config.json');
            if (fs.existsSync(configPath)) {
                try {
                    const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                    script.type = configData.type || 'free';
                    script.author = configData.author || '';
                    script.supportsExecuteOnJoin = configData.supportsExecuteOnJoin !== false;
                    if (configData.name) script.name = configData.name;
                    if (configData.description) script.description = configData.description;
                } catch (error) {
                    console.error(`Failed to parse config for ${folderName}:`, error);
                }
            }
            
            // Read description.txt as fallback
            if (!script.description) {
                const descPath = path.join(scriptPath, 'description.txt');
                if (fs.existsSync(descPath)) {
                    script.description = fs.readFileSync(descPath, 'utf-8').trim();
                }
            }
            
            // Find thumbnail
            const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
            for (const ext of imageExts) {
                const imgPath = path.join(scriptPath, 'image' + ext);
                if (fs.existsSync(imgPath)) {
                    script.thumbnail = imgPath;
                    break;
                }
            }
            
            // Check if script.lua exists
            const luaPath = path.join(scriptPath, 'script.lua');
            if (fs.existsSync(luaPath)) {
                scripts.push(script);
            }
        }
        
        return scripts;
    } catch (error) {
        console.error('Error getting scripts:', error);
        return [];
    }
});

ipcMain.handle('execute-hub-script', async (event, scriptPath, useZexiumAPI = false, savedKey = null) => {
    try {
        const luaFile = path.join(scriptPath, 'script.lua');
        if (!fs.existsSync(luaFile)) {
            return { success: false, message: 'Script file not found' };
        }
        
        // Check if this is Sensation script and handle it specially
        const scriptName = path.basename(scriptPath);
        let scriptContent;
        
        if (scriptName === 'Sensation') {
            // Handle Sensation's special loading logic
            console.log('Executing Sensation with savedKey:', savedKey); // Debug log
            if (savedKey && savedKey.trim()) {
                // Paid version with key - works with both Zexium and Hydrogen
                scriptContent = `script_key="${savedKey}";
loadstring(game:HttpGet("https://api.luarmor.net/files/v3/loaders/730854e5b6499ee91deb1080e8e12ae3.lua"))()`;
                console.log('Using paid version with key'); // Debug log
            } else {
                // Free version - works with both Zexium and Hydrogen
                scriptContent = `loadstring(game:HttpGet("https://api.luarmor.net/files/v4/loaders/730854e5b6499ee91deb1080e8e12ae3.lua"))()`;
                console.log('Using free version (no key)'); // Debug log
            }
        } else {
            // Regular script loading - add key if available for other scripts
            scriptContent = fs.readFileSync(luaFile, 'utf-8');
            if (savedKey && savedKey.trim()) {
                // Prepend key to script content
                scriptContent = `script_key="${savedKey}";\n${scriptContent}`;
            }
        }
        
        // Use Zexium API if enabled and requested
        if (useZexiumAPI && isZexiumAPIEnabled && zexiumServer) {
            return await executeScriptThroughZexium(scriptContent);
        }
        
        // Use the existing Hydrogen execution logic
        const START_PORT = 6969;
        const END_PORT = 7069;
        let serverPort = null;

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
            return { success: false, message: `Hydrogen is not connected to Roblox. ` };
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
                return { success: true, message: `Script executed successfully: ${resultText}` };
            } else {
                const errorText = await response.text();
                return { success: false, message: `HTTP ${response.status}: ${errorText}` };
            }
        } catch (error) {
            return { success: false, message: error.message };
        }
    } catch (error) {
        return { success: false, message: error.message };
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
            shutdownDiscordRPC();
            stopZexiumServer();
            app.quit();
        });
        mainWindow.webContents.send('request-final-save');
    } else {
        isQuitting = true;
        shutdownDiscordRPC();
        stopZexiumServer();
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
