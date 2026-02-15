const fs = require('fs');
const os = require('os');
const path = require('path');
const { ipcMain, shell } = require('electron');

const SCRIPT_FILE_NAME = 'zyron-rbx-console.txt';
const LOG_FILE_PREFIX = 'zyron-console-';
const LOG_FILE_SUFFIX = '.txt';
const MAX_STORED_LOGS = 5000;
const MAX_FETCH_LOGS = 500;
const MAX_MESSAGE_LENGTH = 4000;
const LOG_POLL_INTERVAL_MS = 120;
const MAX_READ_CHUNK_BYTES = 512 * 1024;

let mainWindow = null;
let loggingEnabled = false;
let consentAccepted = false;
let selectedExecutor = 'hydrogen';
let logPollInterval = null;

let logs = [];
let nextLogSeq = 1;

const logFileSerialByExecutor = {
    hydrogen: null,
    macsploit: null
};

const logReadStateByExecutor = {
    hydrogen: { filePath: null, offset: 0, residual: '' },
    macsploit: { filePath: null, offset: 0, residual: '' }
};

function normalizeExecutor(executor) {
    return executor === 'macsploit' ? 'macsploit' : 'hydrogen';
}

function getAutoexecutePath(executor) {
    const normalized = normalizeExecutor(executor);
    if (normalized === 'macsploit') {
        return path.join(os.homedir(), 'Documents', 'Macsploit Automatic Execution');
    }
    return path.join(os.homedir(), 'Hydrogen', 'autoexecute');
}

function getWorkspacePath(executor) {
    const normalized = normalizeExecutor(executor);
    if (normalized === 'macsploit') {
        return path.join(os.homedir(), 'Documents', 'Macsploit Workspace');
    }
    return path.join(os.homedir(), 'Hydrogen', 'workspace');
}

function getAllAutoexecutePaths() {
    return {
        hydrogen: getAutoexecutePath('hydrogen'),
        macsploit: getAutoexecutePath('macsploit')
    };
}

function randomSerial() {
    return String(Math.floor(10000 + Math.random() * 900000));
}

function getOrCreateLogSerial(executor) {
    const normalized = normalizeExecutor(executor);
    if (!logFileSerialByExecutor[normalized]) {
        logFileSerialByExecutor[normalized] = randomSerial();
    }
    return logFileSerialByExecutor[normalized];
}

function getLogFileName(executor) {
    const serial = getOrCreateLogSerial(executor);
    return `${LOG_FILE_PREFIX}${serial}${LOG_FILE_SUFFIX}`;
}

function deleteConsoleScriptFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error(`Failed to delete console script at ${filePath}:`, error.message);
    }
}

function safeUnlink(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error(`Failed to delete file at ${filePath}:`, error.message);
    }
}

function buildConsoleCollectorScript(logFileName) {
    return `local HttpService = game:GetService("HttpService")
local LogService = game:GetService("LogService")

if type(writefile) ~= "function" or type(appendfile) ~= "function" then
    return
end

local LOG_FILE = "${logFileName}"
local FLUSH_INTERVAL = 0.12
local MAX_BATCH = 80
local MAX_QUEUE = 2000

local queue = {}
local queue_start = 1

local function queue_size()
    return #queue - queue_start + 1
end

local function compact_queue_if_needed()
    if queue_start < 120 then
        return
    end
    local rebuilt = {}
    for i = queue_start, #queue do
        rebuilt[#rebuilt + 1] = queue[i]
    end
    queue = rebuilt
    queue_start = 1
end

local function trim_queue()
    while queue_size() > MAX_QUEUE do
        queue[queue_start] = nil
        queue_start += 1
    end
    compact_queue_if_needed()
end

local function now_iso()
    return os.date("!%Y-%m-%dT%H:%M:%SZ")
end

local function normalize_type(message_type)
    if typeof(message_type) == "EnumItem" then
        return message_type.Name
    end
    return tostring(message_type or "MessageInfo")
end

local function enqueue(message, message_type)
    queue[#queue + 1] = {
        message = tostring(message or ""),
        type = normalize_type(message_type),
        time = now_iso()
    }
    trim_queue()
end

local function encode_line(entry)
    local ok, encoded = pcall(function()
        return HttpService:JSONEncode(entry)
    end)
    if not ok then
        return nil
    end
    return encoded
end

local function pop_batch(max_count)
    local available = queue_size()
    if available <= 0 then
        return {}
    end

    local count = math.min(max_count, available)
    local batch = table.create(count)
    for i = 1, count do
        batch[i] = queue[queue_start]
        queue[queue_start] = nil
        queue_start += 1
    end
    compact_queue_if_needed()
    return batch
end

local function requeue_front(batch)
    if #batch == 0 then
        return
    end

    local rebuilt = {}
    for i = 1, #batch do
        rebuilt[#rebuilt + 1] = batch[i]
    end
    for i = queue_start, #queue do
        rebuilt[#rebuilt + 1] = queue[i]
    end
    queue = rebuilt
    queue_start = 1
    trim_queue()
end

local function flush_once()
    if queue_size() <= 0 then
        return
    end

    local batch = pop_batch(MAX_BATCH)
    if #batch == 0 then
        return
    end

    local lines = table.create(#batch)
    for i = 1, #batch do
        local encoded = encode_line(batch[i])
        if encoded then
            lines[#lines + 1] = encoded
        end
    end

    if #lines == 0 then
        return
    end

    local payload = table.concat(lines, "\\n") .. "\\n"
    local ok = pcall(function()
        appendfile(LOG_FILE, payload)
    end)

    if not ok then
        requeue_front(batch)
    end
end

pcall(function()
    writefile(LOG_FILE, "")
end)

for _, entry in ipairs(LogService:GetLogHistory()) do
    enqueue(entry.message, entry.messageType)
end

LogService.MessageOut:Connect(function(message, message_type)
    enqueue(message, message_type)
end)

task.spawn(function()
    while true do
        task.wait(FLUSH_INTERVAL)
        flush_once()
    end
end)
`;
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

function parseLogLinesFromChunk(rawChunk, readState) {
    const combined = `${readState.residual}${rawChunk}`;
    const lines = combined.split(/\r?\n/);
    readState.residual = lines.pop() || '';

    const parsedEntries = [];
    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
            const payload = JSON.parse(trimmed);
            parsedEntries.push({
                message: payload && payload.message ? String(payload.message) : '',
                type: payload && payload.type ? String(payload.type) : 'MessageInfo',
                receivedAt: payload && payload.time ? String(payload.time) : new Date().toISOString()
            });
        } catch (error) {
            parsedEntries.push({
                message: trimmed,
                type: 'MessageInfo',
                receivedAt: new Date().toISOString()
            });
        }
    });

    return parsedEntries;
}

function pollWorkspaceLogFile() {
    if (!loggingEnabled || !consentAccepted) return;

    const executor = normalizeExecutor(selectedExecutor);
    const readState = logReadStateByExecutor[executor];
    if (!readState || !readState.filePath) return;
    if (!fs.existsSync(readState.filePath)) return;

    try {
        const stats = fs.statSync(readState.filePath);
        if (stats.size < readState.offset) {
            readState.offset = 0;
            readState.residual = '';
        }

        if (stats.size <= readState.offset) return;

        const bytesRemaining = stats.size - readState.offset;
        const bytesToRead = Math.min(bytesRemaining, MAX_READ_CHUNK_BYTES);
        const buffer = Buffer.allocUnsafe(bytesToRead);
        const fd = fs.openSync(readState.filePath, 'r');

        try {
            fs.readSync(fd, buffer, 0, bytesToRead, readState.offset);
        } finally {
            fs.closeSync(fd);
        }

        readState.offset += bytesToRead;
        const parsedEntries = parseLogLinesFromChunk(buffer.toString('utf8'), readState);
        pushLogs(parsedEntries);
    } catch (error) {
        console.error('Failed to poll workspace log file:', error.message);
    }
}

function startLogPolling() {
    if (logPollInterval) return;
    logPollInterval = setInterval(pollWorkspaceLogFile, LOG_POLL_INTERVAL_MS);
}

function stopLogPolling() {
    if (!logPollInterval) return;
    clearInterval(logPollInterval);
    logPollInterval = null;
}

async function ensureConsoleScript() {
    const paths = getAllAutoexecutePaths();

    if (!loggingEnabled || !consentAccepted) {
        deleteConsoleScriptFile(path.join(paths.hydrogen, SCRIPT_FILE_NAME));
        deleteConsoleScriptFile(path.join(paths.macsploit, SCRIPT_FILE_NAME));
        if (logReadStateByExecutor.hydrogen.filePath) {
            safeUnlink(logReadStateByExecutor.hydrogen.filePath);
        }
        if (logReadStateByExecutor.macsploit.filePath) {
            safeUnlink(logReadStateByExecutor.macsploit.filePath);
        }
        logReadStateByExecutor.hydrogen = { filePath: null, offset: 0, residual: '' };
        logReadStateByExecutor.macsploit = { filePath: null, offset: 0, residual: '' };
        return {
            success: true,
            scriptActive: false
        };
    }

    const activePath = getAutoexecutePath(selectedExecutor);
    const inactivePath = getAutoexecutePath(selectedExecutor === 'hydrogen' ? 'macsploit' : 'hydrogen');
    const activeLabel = selectedExecutor === 'hydrogen' ? 'Hydrogen' : 'MacSploit';
    const activeWorkspacePath = getWorkspacePath(selectedExecutor);

    if (!fs.existsSync(activePath)) {
        return {
            success: false,
            scriptActive: false,
            error: `Autoexecute folder doesn't exist for ${activeLabel}.`
        };
    }

    if (!fs.existsSync(activeWorkspacePath)) {
        return {
            success: false,
            scriptActive: false,
            error: `${activeLabel} workspace folder doesn't exist.`
        };
    }

    try {
        const logFileName = getLogFileName(selectedExecutor);
        const scriptPath = path.join(activePath, SCRIPT_FILE_NAME);
        const logFilePath = path.join(activeWorkspacePath, logFileName);
        const scriptContent = buildConsoleCollectorScript(logFileName);

        fs.writeFileSync(scriptPath, scriptContent, 'utf8');
        fs.writeFileSync(logFilePath, '', 'utf8');
        deleteConsoleScriptFile(path.join(inactivePath, SCRIPT_FILE_NAME));

        logReadStateByExecutor[selectedExecutor] = {
            filePath: logFilePath,
            offset: 0,
            residual: ''
        };

        return {
            success: true,
            scriptActive: true,
            scriptPath,
            logFilePath
        };
    } catch (error) {
        return {
            success: false,
            scriptActive: false,
            error: error.message
        };
    }
}

function registerIpcHandlers() {
    ipcMain.handle('console-set-config', async (event, config = {}) => {
        loggingEnabled = Boolean(config.enabled);
        consentAccepted = Boolean(config.accepted);
        selectedExecutor = normalizeExecutor(config.executor);

        const syncResult = await ensureConsoleScript();
        return {
            success: syncResult.success,
            error: syncResult.error || null,
            scriptActive: Boolean(syncResult.scriptActive),
            selectedExecutor
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

    ipcMain.handle('console-open-autoexec-path', async (event, executor) => {
        const selected = normalizeExecutor(executor);
        const targetPath = getAutoexecutePath(selected);

        if (!fs.existsSync(targetPath)) {
            return {
                success: false,
                error: "Autoexecute folder doesn't exist for the selected executor."
            };
        }

        const openError = await shell.openPath(targetPath);
        if (openError) {
            return {
                success: false,
                error: openError
            };
        }

        return {
            success: true,
            path: targetPath
        };
    });

    ipcMain.handle('console-clear-logs', () => {
        logs = [];

        const executor = normalizeExecutor(selectedExecutor);
        const state = logReadStateByExecutor[executor];
        if (state && state.filePath) {
            try {
                fs.writeFileSync(state.filePath, '', 'utf8');
                state.offset = 0;
                state.residual = '';
            } catch (error) {
                console.error('Failed to clear workspace console file:', error.message);
            }
        }

        return { success: true };
    });
}

function initialize(window) {
    mainWindow = window;
    registerIpcHandlers();
    startLogPolling();
}

function shutdown() {
    const paths = getAllAutoexecutePaths();
    deleteConsoleScriptFile(path.join(paths.hydrogen, SCRIPT_FILE_NAME));
    deleteConsoleScriptFile(path.join(paths.macsploit, SCRIPT_FILE_NAME));

    const hydrogenLog = logReadStateByExecutor.hydrogen && logReadStateByExecutor.hydrogen.filePath;
    const macsploitLog = logReadStateByExecutor.macsploit && logReadStateByExecutor.macsploit.filePath;
    if (hydrogenLog) safeUnlink(hydrogenLog);
    if (macsploitLog) safeUnlink(macsploitLog);

    stopLogPolling();
    mainWindow = null;
}

module.exports = {
    initialize,
    shutdown
};
