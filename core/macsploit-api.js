const net = require('net');

const HOST = '127.0.0.1';
const START_PORT = 5553;
const END_PORT = 5562;
const CONNECT_TIMEOUT_MS = 200;

const IPC_EXECUTE = 0;

let lastKnownPort = null;

function buildExecutePayload(script) {
    const encoded = Buffer.from(script, 'utf8');
    const data = Buffer.alloc(16 + encoded.length + 1);
    data.writeUInt8(IPC_EXECUTE, 0);
    data.writeInt32LE(encoded.length, 8);
    data.write(script, 16, 'utf8');
    return data;
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
    for (let port = START_PORT; port <= END_PORT; port++) {
        const connected = await tryConnect(port);
        if (connected) {
            lastKnownPort = port;
            return port;
        }
    }
    lastKnownPort = null;
    return null;
}

async function checkMacsploitConnection() {
    const port = await findAvailablePort();
    return port !== null;
}

async function executeScript(scriptContent) {
    let port = lastKnownPort;
    if (!port) {
        port = await findAvailablePort();
    }

    if (!port) {
        return { success: false, message: 'Could not connect to MacSploit. Try restarting MacSploit or Roblox.' };
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

        socket.setTimeout(2000);
        socket.once('connect', () => {
            const payload = buildExecutePayload(scriptContent);
            socket.write(payload, (err) => {
                if (err) {
                    finish({ success: false, message: err.message });
                    return;
                }
                socket.end();
                finish({ success: true, message: `Script submitted successfully via MacSploit (${port})` });
            });
        });

        socket.once('error', (err) => finish({ success: false, message: err.message }));
        socket.once('timeout', () => finish({ success: false, message: 'MacSploit connection timed out' }));
        socket.once('close', () => finish({ success: false, message: 'MacSploit connection closed' }));
    });
}

module.exports = {
    checkMacsploitConnection,
    executeScript
};
