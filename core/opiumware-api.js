const net = require('net');
const zlib = require('zlib');

const HOST = '127.0.0.1';
const START_PORT = 8392;
const END_PORT = 8397;
const CONNECT_TIMEOUT_MS = 200;
const EXECUTE_TIMEOUT_MS = 2000;

let lastKnownPort = null;

function normalizeCommand(scriptContent) {
    const text = String(scriptContent || '');
    const trimmed = text.trim();
    if (!trimmed) {
        return 'OpiumwareScript ';
    }
    if (/^Opiumware(?:Script|Setting)\b/.test(trimmed)) {
        return trimmed;
    }
    return `OpiumwareScript ${text}`;
}

function deflateUtf8(text) {
    return new Promise((resolve, reject) => {
        zlib.deflate(Buffer.from(text, 'utf8'), (error, compressed) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(compressed);
        });
    });
}

function tryConnect(port) {
    return new Promise((resolve) => {
        const socket = net.createConnection({ host: HOST, port });
        let finished = false;

        const finish = (result) => {
            if (finished) return;
            finished = true;
            socket.removeAllListeners();
            socket.destroy();
            resolve(result);
        };

        socket.setTimeout(CONNECT_TIMEOUT_MS);
        socket.once('connect', () => finish(true));
        socket.once('error', () => finish(false));
        socket.once('timeout', () => finish(false));
        socket.once('close', () => finish(false));
    });
}

async function findAvailablePort() {
    for (let port = START_PORT; port <= END_PORT; port += 1) {
        const connected = await tryConnect(port);
        if (connected) {
            lastKnownPort = port;
            return port;
        }
    }
    lastKnownPort = null;
    return null;
}

async function checkOpiumwareConnection() {
    const port = await findAvailablePort();
    return port !== null;
}

async function executeScript(scriptContent) {
    let port = lastKnownPort;
    if (!port) {
        port = await findAvailablePort();
    }

    if (!port) {
        return { success: false, message: 'Could not connect to Opiumware. Try restarting Opiumware or Roblox.' };
    }

    const command = normalizeCommand(scriptContent);
    let payload;
    try {
        payload = await deflateUtf8(command);
    } catch (error) {
        return { success: false, message: `Failed to encode Opiumware payload: ${error.message}` };
    }

    return new Promise((resolve) => {
        const socket = net.createConnection({ host: HOST, port });
        let finished = false;

        const finish = (result) => {
            if (finished) return;
            finished = true;
            socket.removeAllListeners();
            socket.destroy();
            resolve(result);
        };

        socket.setTimeout(EXECUTE_TIMEOUT_MS);
        socket.once('connect', () => {
            socket.write(payload, (error) => {
                if (error) {
                    finish({ success: false, message: error.message });
                    return;
                }
                socket.end();
                finish({ success: true, message: `Script submitted successfully via Opiumware (${port})` });
            });
        });

        socket.once('error', (error) => finish({ success: false, message: error.message }));
        socket.once('timeout', () => finish({ success: false, message: 'Opiumware connection timed out' }));
        socket.once('close', () => finish({ success: false, message: 'Opiumware connection closed' }));
    });
}

module.exports = {
    checkOpiumwareConnection,
    executeScript
};
