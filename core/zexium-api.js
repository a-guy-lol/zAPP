const WebSocket = require('ws');
const net = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ipcMain } = require('electron');
const dataManager = require('./data-manager');

const HYDROGEN_DIR = path.join(os.homedir(), 'Hydrogen');
const AUTOEXEC_DIR = path.join(HYDROGEN_DIR, 'autoexecute');
const ZEXIUM_API_FILE = path.join(AUTOEXEC_DIR, 'zexiumAPI.lua');

let isZexiumAPIEnabled = false;
let zexiumServer = null;
let zexiumPort = null;

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

async function handleExecuteOnJoin() {
    if (!isZexiumAPIEnabled || !zexiumServer) {
        return;
    }

    try {
        const dataResult = await dataManager.loadAppData();
        if (!dataResult.success || !dataResult.data || !dataResult.data.scriptSettings) {
            return;
        }

        const scriptsToExecute = [];
        const scriptSettings = dataResult.data.scriptSettings;

        for (const [scriptName, settings] of Object.entries(scriptSettings)) {
            if (settings.executeOnJoin) {
                const scriptsDir = path.join(__dirname, '..', 'src', 'scripts');
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

async function startZexiumServer() {
    if (zexiumServer) {
        return { success: true, port: zexiumPort };
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
    
    if Players.LocalPlayer then
        currentGameId = game.GameId
        handleGameJoin()
    end
    
    local function monitorGameChanges()
        spawn(function()
            while isConnected and ws do
                wait(2)
                
                local newGameId = game.GameId
                if newGameId ~= currentGameId then
                    hasExecutedOnJoin = false
                    handleGameJoin()
                end
                
                if not Players.LocalPlayer or not game:IsLoaded() then
                    disconnectWebSocket()
                    break
                end
            end
        end)
    end
    
    monitorGameChanges()
    
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

// IPC handlers
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

ipcMain.handle('execute-script-zexium', async (event, scriptContent) => {
    return await executeScriptThroughZexium(scriptContent);
});

ipcMain.handle('execute-on-join-scripts', async () => {
    if (!isZexiumAPIEnabled || !zexiumServer) {
        return { success: false, message: 'Zexium API not enabled or server not running' };
    }

    try {
        const dataResult = await dataManager.loadAppData();
        if (!dataResult.success || !dataResult.data || !dataResult.data.scriptSettings) {
            return { success: true, message: 'No scripts to execute on join' };
        }

        const scriptsToExecute = [];
        const scriptSettings = dataResult.data.scriptSettings;

        for (const [scriptName, settings] of Object.entries(scriptSettings)) {
            if (settings.executeOnJoin) {
                const scriptsDir = path.join(__dirname, '..', 'src', 'scripts');
                const scriptPath = path.join(scriptsDir, scriptName);
                const luaFile = path.join(scriptPath, 'script.lua');
                
                if (fs.existsSync(luaFile)) {
                    let scriptContent;
                    
                    if (scriptName === 'Sensation') {
                        if (settings.savedKey && settings.savedKey.trim()) {
                            scriptContent = `script_key="${settings.savedKey}";
loadstring(game:HttpGet("https://api.luarmor.net/files/v3/loaders/730854e5b6499ee91deb1080e8e12ae3.lua"))()`;
                        } else {
                            scriptContent = `loadstring(game:HttpGet("https://api.luarmor.net/files/v4/loaders/730854e5b6499ee91deb1080e8e12ae3.lua"))()`;
                        }
                    } else {
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

function initialize() {
}

function shutdown() {
    stopZexiumServer();
}

module.exports = {
    initialize,
    shutdown,
    startZexiumServer,
    stopZexiumServer,
    executeScriptThroughZexium
};
