const fetch = require('node-fetch');
const { ipcMain } = require('electron');
const discordRPC = require('./discord-rpc');
const macsploitAPI = require('./macsploit-api');

let isExecutorConnected = false;
let selectedExecutor = 'auto';
let lastResolvedAutoExecutor = 'hydrogen';
let resolvedExecutor = null;

async function checkHydrogenConnection() {
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
  
  return connectedNow;
}

function normalizeExecutor(executor) {
  if (executor === 'hydrogen') return 'hydrogen';
  if (executor === 'macsploit') return 'macsploit';
  return 'auto';
}

async function resolveAutoExecutor() {
  const checks = await Promise.all([
    checkHydrogenConnection(),
    macsploitAPI.checkMacsploitConnection()
  ]);
  const [hydrogenConnected, macsploitConnected] = checks;

  if (hydrogenConnected && macsploitConnected) {
    return {
      connected: true,
      executor: lastResolvedAutoExecutor === 'macsploit' ? 'macsploit' : 'hydrogen'
    };
  }

  if (hydrogenConnected) {
    lastResolvedAutoExecutor = 'hydrogen';
    return { connected: true, executor: 'hydrogen' };
  }

  if (macsploitConnected) {
    lastResolvedAutoExecutor = 'macsploit';
    return { connected: true, executor: 'macsploit' };
  }

  return { connected: false, executor: null };
}

async function getExecutorRuntimeStatus() {
  const normalizedSelectedExecutor = normalizeExecutor(selectedExecutor);

  if (normalizedSelectedExecutor === 'auto') {
    const autoResult = await resolveAutoExecutor();
    resolvedExecutor = autoResult.connected ? autoResult.executor : null;
    return {
      connected: autoResult.connected,
      selectedExecutor: normalizedSelectedExecutor,
      resolvedExecutor
    };
  }

  const connected = normalizedSelectedExecutor === 'macsploit'
    ? await macsploitAPI.checkMacsploitConnection()
    : await checkHydrogenConnection();

  resolvedExecutor = connected ? normalizedSelectedExecutor : null;
  return {
    connected,
    selectedExecutor: normalizedSelectedExecutor,
    resolvedExecutor
  };
}

async function checkSelectedExecutorConnection() {
  const status = await getExecutorRuntimeStatus();
  if (status.connected && status.resolvedExecutor) {
    lastResolvedAutoExecutor = status.resolvedExecutor;
  }
  return status.connected;
}

async function executeThroughHydrogen(scriptContent) {
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
      return { success: false, message: 'Could not connect to Hydrogen. Try restarting Hydrogen or Roblox.' };
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
          return { success: true, message: `Script submitted successfully: ${resultText}` };
      } else {
          const errorText = await response.text();
          return { success: false, message: `HTTP ${response.status}: ${errorText}` };
      }
  } catch (error) {
      return { success: false, message: error.message };
  }
}

async function executeScript(scriptContent) {
  discordRPC.updateActivity({ details: 'Executing a script' });
  try {
    if (selectedExecutor === 'auto') {
      const resolved = await resolveAutoExecutor();
      if (!resolved.connected || !resolved.executor) {
        return { success: false, message: 'Could not connect to Hydrogen or MacSploit. Try restarting your executor or Roblox.' };
      }
      lastResolvedAutoExecutor = resolved.executor;
      if (resolved.executor === 'macsploit') {
        return await macsploitAPI.executeScript(scriptContent);
      }
      return await executeThroughHydrogen(scriptContent);
    }
    if (selectedExecutor === 'macsploit') {
      return await macsploitAPI.executeScript(scriptContent);
    }
    return await executeThroughHydrogen(scriptContent);
  } finally {
    discordRPC.updateActivity();
  }
}

ipcMain.handle('execute-script', async (event, scriptContent) => {
  return await executeScript(scriptContent);
});

ipcMain.handle('check-connection', async () => {
  const status = await getExecutorRuntimeStatus();
  const connectedNow = status.connected;

  if (connectedNow !== isExecutorConnected) {
      isExecutorConnected = connectedNow;
      discordRPC.updateConnectionStatus(connectedNow);
  }

  if (connectedNow && status.resolvedExecutor) {
      lastResolvedAutoExecutor = status.resolvedExecutor;
  }

  return status;
});

ipcMain.handle('set-selected-executor', async (event, executor) => {
  selectedExecutor = normalizeExecutor(executor);
  const connectedNow = await checkSelectedExecutorConnection();
  if (connectedNow !== isExecutorConnected) {
      isExecutorConnected = connectedNow;
      discordRPC.updateConnectionStatus(connectedNow);
  }
  return { success: true, executor: selectedExecutor };
});

ipcMain.handle('get-selected-executor', () => {
  return selectedExecutor;
});

ipcMain.handle('get-executor-runtime-status', async () => {
  return getExecutorRuntimeStatus();
});

function initialize() {
}

function getConnectionStatus() {
    return isExecutorConnected;
}

module.exports = {
    initialize,
    executeScript,
    checkHydrogenConnection,
    getConnectionStatus
};
