const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');
const fetch = require('node-fetch');
const hydrogenAPI = require('./hydrogen-api');
const autoexecuteManager = require('./autoexecute-manager');
const dataManager = require('./data-manager');

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const SCRIPTBLOX_BASE_URL = 'https://scriptblox.com';
const SCRIPTBLOX_TIMEOUT_MS = 10000;
const SCRIPTBLOX_MAX_LIMIT = 20;

function sanitizeScriptId(rawId) {
    if (typeof rawId !== 'string') return null;
    const normalized = rawId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || null;
}

function getScriptsDir() {
    return path.join(__dirname, '..', 'src', 'scripts');
}

function discoverScripts() {
    const scriptsDir = getScriptsDir();
    if (!fs.existsSync(scriptsDir)) {
        return [];
    }

    const scriptFolders = fs.readdirSync(scriptsDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

    const scripts = [];

    for (const folderName of scriptFolders) {
        const scriptPath = path.join(scriptsDir, folderName);
        const luaPath = path.join(scriptPath, 'script.lua');
        if (!fs.existsSync(luaPath)) continue;

        const script = {
            id: sanitizeScriptId(folderName),
            name: folderName,
            path: scriptPath,
            description: '',
            thumbnail: null,
            type: 'free',
            author: '',
            supportsExecuteOnJoin: true
        };

        const configPath = path.join(scriptPath, 'config.json');
        if (fs.existsSync(configPath)) {
            try {
                const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                script.type = configData.type || 'free';
                script.author = configData.author || '';
                script.supportsExecuteOnJoin = configData.supportsExecuteOnJoin !== false;
                if (configData.name) script.name = configData.name;
                if (configData.description) script.description = configData.description;
                script.id = sanitizeScriptId(configData.scriptId || configData.id) || script.id;
            } catch (error) {
                console.error(`Failed to parse config for ${folderName}:`, error);
            }
        }

        if (!script.description) {
            const descPath = path.join(scriptPath, 'description.txt');
            if (fs.existsSync(descPath)) {
                script.description = fs.readFileSync(descPath, 'utf-8').trim();
            }
        }

        for (const ext of IMAGE_EXTS) {
            const imgPath = path.join(scriptPath, 'image' + ext);
            if (fs.existsSync(imgPath)) {
                script.thumbnail = imgPath;
                break;
            }
        }

        if (!script.id) {
            script.id = sanitizeScriptId(script.name) || sanitizeScriptId(folderName) || 'script';
        }

        scripts.push(script);
    }

    return scripts;
}

function buildHubScriptContent(scriptPath, savedKey = null) {
    const luaFile = path.join(scriptPath, 'script.lua');
    if (!fs.existsSync(luaFile)) {
        throw new Error('Script file not found');
    }

    const scriptFolderName = path.basename(scriptPath);
    const key = typeof savedKey === 'string' ? savedKey.trim() : '';

    if (scriptFolderName === 'Sensation') {
        if (key) {
            return `script_key="${key}";
loadstring(game:HttpGet("https://api.luarmor.net/files/v3/loaders/730854e5b6499ee91deb1080e8e12ae3.lua"))()`;
        }
        return 'loadstring(game:HttpGet("https://api.luarmor.net/files/v4/loaders/730854e5b6499ee91deb1080e8e12ae3.lua"))()';
    }

    const scriptContent = fs.readFileSync(luaFile, 'utf-8');
    if (!key) {
        return scriptContent;
    }
    return `script_key="${key}";\n${scriptContent}`;
}

function getScriptSettings(settingsMap, script) {
    return settingsMap?.[script.id] || settingsMap?.[script.name] || null;
}

function withTimeout(promise, timeoutMs, errorMessage) {
    let timeoutId = null;
    const timeoutPromise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(errorMessage));
        }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    });
}

async function fetchScriptBloxJson(pathname, queryParams = null) {
    const url = new URL(pathname, SCRIPTBLOX_BASE_URL);
    if (queryParams && typeof queryParams === 'object') {
        Object.entries(queryParams).forEach(([key, value]) => {
            if (value === null || typeof value === 'undefined' || value === '') return;
            url.searchParams.set(key, String(value));
        });
    }

    const response = await withTimeout(
        fetch(url.toString(), {
            method: 'GET',
            headers: {
                accept: 'application/json',
                'user-agent': 'Zyron/1.5'
            }
        }),
        SCRIPTBLOX_TIMEOUT_MS,
        'ScriptBlox request timed out.'
    );

    if (!response.ok) {
        throw new Error(`ScriptBlox request failed (${response.status}).`);
    }

    const payload = await response.json();
    if (payload?.message && !payload?.result && !payload?.script) {
        throw new Error(String(payload.message));
    }
    return payload || {};
}

ipcMain.handle('get-scripts', async () => {
    try {
        return discoverScripts();
    } catch (error) {
        console.error('Error getting scripts:', error);
        return [];
    }
});

ipcMain.handle('execute-hub-script', async (event, scriptPath, savedKey = null) => {
    try {
        const scriptContent = buildHubScriptContent(scriptPath, savedKey);
        return await hydrogenAPI.executeScript(scriptContent);
    } catch (error) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('sync-script-hub-autoexecute', async (event, payload = {}) => {
    try {
        const forceDisable = Boolean(payload?.forceDisable);
        const scripts = discoverScripts();
        const appDataResult = await dataManager.loadAppData();
        if (!appDataResult.success) {
            return { success: false, error: appDataResult.error || 'Failed to load app data.' };
        }

        const settingsMap = appDataResult.data?.scriptSettings || {};
        const syncEntries = scripts.map((script) => {
            const settings = getScriptSettings(settingsMap, script) || {};
            let enabled = !forceDisable && Boolean(script.supportsExecuteOnJoin && settings.executeOnJoin);
            let content = '';
            if (enabled) {
                try {
                    content = buildHubScriptContent(script.path, settings.savedKey);
                } catch (error) {
                    console.error(`Failed to build execute-on-join content for ${script.name}:`, error);
                    enabled = false;
                }
            }
            return {
                scriptId: script.id,
                enabled,
                content
            };
        });

        return autoexecuteManager.syncAutoexecuteScripts({
            executor: payload.executor,
            scripts: syncEntries
        });
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('scriptblox-trending', async () => {
    try {
        const payload = await fetchScriptBloxJson('/api/script/trending');
        const scripts = Array.isArray(payload?.result?.scripts) ? payload.result.scripts : [];
        return {
            success: true,
            result: {
                max: Number(payload?.result?.max) || scripts.length,
                scripts
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('scriptblox-search', async (event, options = {}) => {
    try {
        const query = String(options?.query ?? options?.q ?? '').trim();
        if (!query) {
            return {
                success: true,
                result: {
                    totalPages: 1,
                    page: 1,
                    max: SCRIPTBLOX_MAX_LIMIT,
                    scripts: []
                }
            };
        }

        const pageValue = Math.floor(Number(options?.page));
        const maxValue = Math.floor(Number(options?.max));
        const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;
        const max = Number.isFinite(maxValue) && maxValue > 0
            ? Math.min(SCRIPTBLOX_MAX_LIMIT, maxValue)
            : SCRIPTBLOX_MAX_LIMIT;

        const payload = await fetchScriptBloxJson('/api/script/search', {
            q: query,
            page,
            max
        });
        const scripts = Array.isArray(payload?.result?.scripts) ? payload.result.scripts : [];
        const totalPages = Math.max(1, Number(payload?.result?.totalPages) || 1);

        return {
            success: true,
            result: {
                totalPages,
                page: Math.min(page, totalPages),
                max,
                scripts
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('scriptblox-get-script-content', async (event, scriptIdentifier) => {
    try {
        const normalizedIdentifier = String(scriptIdentifier || '').trim();
        if (!normalizedIdentifier) {
            return { success: false, error: 'Script identifier is required.' };
        }

        let content = '';
        try {
            const payload = await fetchScriptBloxJson(`/api/script/${encodeURIComponent(normalizedIdentifier)}`);
            if (typeof payload?.script?.script === 'string') {
                content = payload.script.script;
            }
        } catch (error) {
            return { success: false, error: error.message };
        }

        if (!content || !content.trim()) {
            return { success: false, error: 'Script content is unavailable.' };
        }

        return { success: true, content };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

function initialize() {
}

module.exports = {
    initialize
};
