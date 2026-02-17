const fs = require('fs');
const os = require('os');
const path = require('path');
const { ipcMain } = require('electron');

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

function normalizeSerial(serial) {
    const parsed = Number(serial);
    if (!Number.isFinite(parsed)) return null;
    if (parsed <= 0) return null;
    return String(Math.floor(parsed));
}

function normalizeScriptId(scriptId) {
    if (typeof scriptId !== 'string') return null;
    const normalized = scriptId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || null;
}

function resolveEntryId(entry = {}) {
    const serial = normalizeSerial(entry.serial);
    if (serial) return serial;
    return normalizeScriptId(entry.scriptId);
}

function getFileNameForId(id) {
    return `zyron-${id}.txt`;
}

function writeAutoexecuteScript(folderPath, id, scriptContent) {
    const fileName = getFileNameForId(id);
    const filePath = path.join(folderPath, fileName);
    fs.writeFileSync(filePath, String(scriptContent || ''), 'utf8');
}

function removeAutoexecuteScript(folderPath, id) {
    const fileName = getFileNameForId(id);
    const filePath = path.join(folderPath, fileName);
    if (!fs.existsSync(filePath)) return;
    fs.unlinkSync(filePath);
}

function syncAutoexecuteScripts(payload = {}) {
    const selectedExecutor = normalizeExecutor(payload.executor);
    const activePath = getAutoexecutePath(selectedExecutor);
    const inactivePath = getAutoexecutePath(selectedExecutor === 'hydrogen' ? 'macsploit' : 'hydrogen');

    if (!fs.existsSync(activePath)) {
        return {
            success: false,
            error: "Autoexecute folder doesn't exist for the selected executor."
        };
    }

    const scripts = Array.isArray(payload.scripts) ? payload.scripts : [];
    const touchedIds = [];

    try {
        scripts.forEach((entry) => {
            if (!entry || typeof entry !== 'object') return;
            const id = resolveEntryId(entry);
            if (!id) return;
            touchedIds.push(id);

            const enabled = Boolean(entry.enabled);
            const scriptContent = typeof entry.content === 'string' ? entry.content : '';

            if (enabled) {
                writeAutoexecuteScript(activePath, id, scriptContent);
                removeAutoexecuteScript(inactivePath, id);
            } else {
                removeAutoexecuteScript(activePath, id);
                removeAutoexecuteScript(inactivePath, id);
            }
        });

        return {
            success: true,
            executor: selectedExecutor,
            syncedScripts: touchedIds.length
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

function initialize() {
    ipcMain.handle('sync-autoexecute-scripts', (event, payload = {}) => {
        return syncAutoexecuteScripts(payload);
    });
}

module.exports = {
    initialize,
    syncAutoexecuteScripts
};
