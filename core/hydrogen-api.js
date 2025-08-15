const fetch = require('node-fetch');
const { ipcMain } = require('electron');
const discordRPC = require('./discord-rpc');

let isHydrogenConnected = false;

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
  
  if (connectedNow !== isHydrogenConnected) {
      isHydrogenConnected = connectedNow;
      discordRPC.updateConnectionStatus(connectedNow);
  }
  return connectedNow;
}

async function executeScript(scriptContent) {
  const START_PORT = 6969;
  const END_PORT = 7069;
  let serverPort = null;

  discordRPC.updateActivity({ details: 'Executing a script' });

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
      discordRPC.updateActivity();
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
          discordRPC.updateActivity();
          return { success: true, message: `Script submitted successfully: ${resultText}` };
      } else {
          const errorText = await response.text();
          discordRPC.updateActivity();
          return { success: false, message: `HTTP ${response.status}: ${errorText}` };
      }
  } catch (error) {
      discordRPC.updateActivity();
      return { success: false, message: error.message };
  }
}

ipcMain.handle('execute-script', async (event, scriptContent) => {
  return await executeScript(scriptContent);
});

ipcMain.handle('check-connection', async () => {
  return await checkHydrogenConnection();
});

function initialize() {
}

function getConnectionStatus() {
    return isHydrogenConnected;
}

module.exports = {
    initialize,
    executeScript,
    checkHydrogenConnection,
    getConnectionStatus
};
