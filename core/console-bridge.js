const fs = require('fs');
const os = require('os');
const path = require('path');
const { ipcMain, shell } = require('electron');

const MAX_STORED_LOGS = 5000;
const MAX_FETCH_LOGS = 500;
const MAX_MESSAGE_LENGTH = 4000;
const LOG_POLL_INTERVAL_MS = 250;
const MAX_READ_CHUNK_BYTES = 256 * 1024;
const INITIAL_READ_BYTES = 0;
const ROBLOX_LOGS_DIR = path.join(os.homedir(), 'Library', 'Logs', 'Roblox');
const PLAYER_LOG_PATTERN = /_Player_[^/]+_last\.log$/i;
const NOISY_PATTERNS = [
    'settingsurl:',
    'settings date header',
    'settings date timestamp',
    '(appdelegate)',
    'datamodel loading',
    'synccookiesfromnativetoengine',
    'synccookiesfromenginetonative',
    'setassetfolder',
    'setextraassetfolder',
    'evaluating deferred inferred crashes',
    'updater not found',
    'hello world',
    'localstoragehandler',
    'filedescriptorlimitlog',
    'mimalloc',
    'rbxstorage',
    'wrap-deformer',
    'dm notification received',
    'datamodelpatchconfigurer',
    'surfacecontroller',
    'scenemanager',
    'future is bright shadows',
    'maxcloudassetdimension',
    'terrain texturearray',
    'voicechatinternal',
    'rbxtransport',
    'httptrace',
    'websockettrace',
    'signalrcore',
    'trackeranimationstreamsourcetrace',
    'graphics',
    'ugc',
    'gamejoinutil',
    'appmemusagestatus',
    'asset (image)',
    'rbxthumb://',
    'unable to fetch completed survey ids',
    'audiodevice',
    'inputdevice',
    'outputdevice',
    'discovery-ota',
    'networkclient',
    'udmux address',
    'connecting to udmux server',
    'robloxgithash',
    'server robloxgithash',
    'server version:',
    'server prefix:',
    'serverrobloxgithash',
    'analyticssessionid',
    'analyticssessionid is',
    'analytics sessionid',
    'analytics session id',
    'megareplicator',
    'replicator',
    'client:disconnect',
    'connection lost',
    'sending disconnect',
    'disconnect replication data',
    'curlinfo_os_errno',
    'failed to connect to localhost port 5051',
    'error parsing batch thumbnail request',
    'invalid image or texture',
    'requested ids are invalid',
    'load configs for user key'
    ,'client peer updating state'
    ,'application requested close'
    ,'reason player:'
];

let mainWindow = null;
let loggingEnabled = false;
let consentAccepted = false;
let selectedExecutor = 'auto';
let logPollInterval = null;

let logs = [];
let nextLogSeq = 1;
let activeLogState = {
    filePath: null,
    fileName: null,
    offset: 0,
    residual: ''
};

function normalizeExecutor(executor) {
    if (executor === 'hydrogen') return 'hydrogen';
    if (executor === 'macsploit') return 'macsploit';
    return 'auto';
}

function pushLogs(incomingLogs) {
    if (!Array.isArray(incomingLogs) || incomingLogs.length === 0) {
        return;
    }

    for (const entry of incomingLogs) {
        if (!entry || typeof entry !== 'object') continue;

        const rawMessage = typeof entry.message === 'string' ? entry.message : String(entry.message ?? '');
        const message = rawMessage.length > MAX_MESSAGE_LENGTH
            ? `${rawMessage.slice(0, MAX_MESSAGE_LENGTH)}...`
            : rawMessage;
        const type = typeof entry.type === 'string' ? entry.type : 'MessageInfo';
        const receivedAt = typeof entry.receivedAt === 'string' && entry.receivedAt
            ? entry.receivedAt
            : new Date().toISOString();

        logs.push({
            seq: nextLogSeq++,
            message,
            type,
            receivedAt
        });
    }

    if (logs.length > MAX_STORED_LOGS) {
        logs = logs.slice(logs.length - MAX_STORED_LOGS);
    }
}

function resetActiveLogState() {
    activeLogState = {
        filePath: null,
        fileName: null,
        offset: 0,
        residual: ''
    };
}

function getPlayerLogCandidates() {
    try {
        if (!fs.existsSync(ROBLOX_LOGS_DIR)) {
            return [];
        }

        return fs.readdirSync(ROBLOX_LOGS_DIR, { withFileTypes: true })
            .filter((dirent) => dirent.isFile() && PLAYER_LOG_PATTERN.test(dirent.name))
            .map((dirent) => {
                const filePath = path.join(ROBLOX_LOGS_DIR, dirent.name);
                let mtimeMs = 0;
                try {
                    mtimeMs = fs.statSync(filePath).mtimeMs || 0;
                } catch (error) {
                    mtimeMs = 0;
                }
                return {
                    filePath,
                    fileName: dirent.name,
                    mtimeMs
                };
            })
            .sort((a, b) => b.mtimeMs - a.mtimeMs);
    } catch (error) {
        console.error('Failed to scan Roblox logs folder:', error.message);
        return [];
    }
}

function getLatestPlayerLog() {
    const candidates = getPlayerLogCandidates();
    return candidates.length > 0 ? candidates[0] : null;
}

function ensureActiveLogFile() {
    const latestLog = getLatestPlayerLog();
    if (!latestLog) {
        resetActiveLogState();
        return {
            success: false,
            error: 'No Roblox player log file was found.'
        };
    }

    if (activeLogState.filePath === latestLog.filePath) {
        return {
            success: true,
            filePath: activeLogState.filePath,
            fileName: activeLogState.fileName
        };
    }

    let initialOffset = 0;
    try {
        const stats = fs.statSync(latestLog.filePath);
        initialOffset = Math.max(0, (Number(stats.size) || 0) - INITIAL_READ_BYTES);
    } catch (error) {
        initialOffset = 0;
    }

    activeLogState = {
        filePath: latestLog.filePath,
        fileName: latestLog.fileName,
        offset: initialOffset,
        residual: ''
    };

    return {
        success: true,
        filePath: activeLogState.filePath,
        fileName: activeLogState.fileName
    };
}

function normalizeTimestamp(value) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) {
        return new Date().toISOString();
    }
    return new Date(parsed).toISOString();
}

function classifyOutputSeverity(severity) {
    if (severity === 'error' || severity === 'critical') return 'MessageError';
    if (severity === 'warning') return 'MessageWarning';
    return 'MessageInfo';
}

function normalizedSourceIncludesError(source) {
    return String(source || '').toLowerCase().includes('flog::error');
}

function normalizedSourceIncludesWarning(source) {
    return String(source || '').toLowerCase().includes('flog::warning');
}

function shouldDropLogEntry(source, message) {
    const normalizedSource = String(source || '').toLowerCase();
    const normalizedMessage = String(message || '').toLowerCase();
    return NOISY_PATTERNS.some((pattern) => (
        normalizedSource.includes(pattern)
        || normalizedMessage.includes(pattern)
    ));
}

function parseRobloxLogLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;

    const match = trimmed.match(/^([^,]+),[^,]*,[^,]*,[^,\s]+(?:,\s*([A-Za-z]+))?\s+\[([^\]]+)\]\s*(.*)$/);
    if (!match) return null;

    const [, isoCandidate, severityRaw, sourceRaw, messageRaw] = match;
    const source = String(sourceRaw || '').trim();
    const message = String(messageRaw || '').trim();
    if (!message) return null;
    if (shouldDropLogEntry(source, message)) return null;

    const inferredSeverity = normalizedSourceIncludesError(sourceRaw)
        ? 'error'
        : normalizedSourceIncludesWarning(sourceRaw)
            ? 'warning'
            : 'info';
    const severity = String(severityRaw || inferredSeverity).toLowerCase();
    const normalizedSource = source.toLowerCase();

    if (normalizedSource.includes('flog::output')) {
        const cleanedMessage = message.replace(/^info:\s*/i, '').trim();
        if (!cleanedMessage) return null;
        return {
            message: cleanedMessage,
            type: classifyOutputSeverity(severity),
            receivedAt: normalizeTimestamp(isoCandidate)
        };
    }

    if (normalizedSource.includes('flog::warning')) {
        const cleanedMessage = message.replace(/^warning:\s*/i, '').trim();
        if (!cleanedMessage) return null;
        return {
            message: cleanedMessage,
            type: 'MessageWarning',
            receivedAt: normalizeTimestamp(isoCandidate)
        };
    }

    if (severity !== 'error' && severity !== 'critical') {
        return null;
    }

    if (
        !normalizedSource.includes('flog::error')
        && !normalizedSource.includes('loggroup')
        && !normalizedSource.includes('scriptcontext')
    ) {
        return null;
    }

    return {
        message: message.replace(/^Error:\s*/i, '').trim(),
        type: 'MessageError',
        receivedAt: normalizeTimestamp(isoCandidate)
    };
}

function parseLogLinesFromChunk(rawChunk, readState) {
    const combined = `${readState.residual}${rawChunk}`;
    const lines = combined.split(/\r?\n/);
    readState.residual = lines.pop() || '';

    return lines
        .map((line) => parseRobloxLogLine(line))
        .filter(Boolean);
}

function pollRobloxLogFile() {
    if (!loggingEnabled || !consentAccepted) return;

    const activeResult = ensureActiveLogFile();
    if (!activeResult.success || !activeLogState.filePath) return;
    if (!fs.existsSync(activeLogState.filePath)) {
        resetActiveLogState();
        return;
    }

    try {
        const stats = fs.statSync(activeLogState.filePath);
        if (stats.size < activeLogState.offset) {
            activeLogState.offset = 0;
            activeLogState.residual = '';
        }

        if (stats.size <= activeLogState.offset) return;

        const bytesRemaining = stats.size - activeLogState.offset;
        const bytesToRead = Math.min(bytesRemaining, MAX_READ_CHUNK_BYTES);
        const buffer = Buffer.allocUnsafe(bytesToRead);
        const fd = fs.openSync(activeLogState.filePath, 'r');

        try {
            fs.readSync(fd, buffer, 0, bytesToRead, activeLogState.offset);
        } finally {
            fs.closeSync(fd);
        }

        activeLogState.offset += bytesToRead;
        const parsedEntries = parseLogLinesFromChunk(buffer.toString('utf8'), activeLogState);
        pushLogs(parsedEntries);
    } catch (error) {
        console.error('Failed to poll Roblox log file:', error.message);
    }
}

function startLogPolling() {
    if (logPollInterval) return;
    logPollInterval = setInterval(pollRobloxLogFile, LOG_POLL_INTERVAL_MS);
}

function stopLogPolling() {
    if (!logPollInterval) return;
    clearInterval(logPollInterval);
    logPollInterval = null;
}

async function applyLoggingState() {
    if (!loggingEnabled || !consentAccepted) {
        resetActiveLogState();
        return {
            success: true,
            scriptActive: false
        };
    }

    const result = ensureActiveLogFile();
    if (!result.success) {
        return {
            success: false,
            scriptActive: false,
            error: result.error
        };
    }

    return {
        success: true,
        scriptActive: true,
        filePath: activeLogState.filePath,
        fileName: activeLogState.fileName
    };
}

function registerIpcHandlers() {
    ipcMain.handle('console-set-config', async (event, config = {}) => {
        loggingEnabled = Boolean(config.enabled);
        consentAccepted = Boolean(config.accepted);
        selectedExecutor = normalizeExecutor(config.executor);

        const syncResult = await applyLoggingState();
        return {
            success: syncResult.success,
            error: syncResult.error || null,
            scriptActive: Boolean(syncResult.scriptActive),
            selectedExecutor,
            filePath: syncResult.filePath || null,
            fileName: syncResult.fileName || null
        };
    });

    ipcMain.handle('console-get-logs', (event, sinceSeq = 0) => {
        const parsedSinceSeq = Number(sinceSeq) || 0;
        const freshLogs = logs.filter((entry) => entry.seq > parsedSinceSeq).slice(-MAX_FETCH_LOGS);
        const nextSeq = freshLogs.length > 0 ? freshLogs[freshLogs.length - 1].seq : parsedSinceSeq;
        return {
            success: true,
            logs: freshLogs,
            nextSeq
        };
    });

    ipcMain.handle('console-open-logs-path', async () => {
        if (!fs.existsSync(ROBLOX_LOGS_DIR)) {
            return {
                success: false,
                error: "Roblox logs folder doesn't exist."
            };
        }

        const openError = await shell.openPath(ROBLOX_LOGS_DIR);
        if (openError) {
            return {
                success: false,
                error: openError
            };
        }

        return {
            success: true,
            path: ROBLOX_LOGS_DIR
        };
    });

    ipcMain.handle('console-clear-logs', () => {
        logs = [];
        nextLogSeq = 1;
        return { success: true };
    });
}

function initialize(window) {
    mainWindow = window;
    registerIpcHandlers();
    startLogPolling();
}

function shutdown() {
    stopLogPolling();
    resetActiveLogState();
    mainWindow = null;
}

module.exports = {
    initialize,
    shutdown
};
