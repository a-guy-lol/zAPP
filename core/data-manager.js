const fs = require('fs');
const path = require('path');
const os = require('os');
const { ipcMain, app } = require('electron');

const isDevelopment = !app.isPackaged;

const DATA_DIR = isDevelopment 
    ? path.join(__dirname, '..', 'dev-data') 
    : path.join(os.homedir(), 'Documents', 'zyronData');
const DATA_FILE = path.join(DATA_DIR, 'zyron_app_data.json');
const DEFAULT_WORKSPACE_ID = 'ws-scripts';
const DATA_FORMAT_TAG = 'zyron-app-data';
const DATA_SCHEMA_VERSION = '1.5.0';
const KNOWN_LEGACY_SHAPES = new Set([
    'legacy-array',
    'legacy-flat',
    'legacy-partial-envelope',
    'invalid-object',
    'corrupt-json'
]);

if (!isDevelopment && !fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
} else if (isDevelopment && !fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getAppVersionSafe() {
    try {
        const version = app.getVersion();
        return typeof version === 'string' && version.trim() ? version.trim() : 'unknown';
    } catch (error) {
        return 'unknown';
    }
}

function getIsoTimestamp(value, fallback = null) {
    if (typeof value !== 'string' || !value.trim()) {
        return fallback;
    }
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return new Date(parsed).toISOString();
}

function normalizeScriptSettings(rawScriptSettings) {
    if (!rawScriptSettings || typeof rawScriptSettings !== 'object' || Array.isArray(rawScriptSettings)) {
        return {};
    }
    const normalized = {};
    Object.entries(rawScriptSettings).forEach(([key, value]) => {
        if (typeof key !== 'string') return;
        const cleanKey = key.trim();
        if (!cleanKey) return;
        normalized[cleanKey] = value;
    });
    return normalized;
}

function createDefaultData() {
    return {
        tabs: [],
        scriptSettings: {},
        username: null,
        workspaces: [
            {
                id: DEFAULT_WORKSPACE_ID,
                name: 'scripts',
                tabOrder: []
            }
        ],
        autoExecute: {},
        preferences: {}
    };
}

function normalizePreferences(rawPreferences) {
    if (!rawPreferences || typeof rawPreferences !== 'object' || Array.isArray(rawPreferences)) {
        return {};
    }
    const normalized = {};
    Object.entries(rawPreferences).forEach(([key, value]) => {
        if (typeof key !== 'string') return;
        if (!key.trim()) return;
        if (value === null || typeof value === 'undefined') return;
        normalized[key] = String(value);
    });
    return normalized;
}

function buildDefaultMeta({ createdAt = null, updatedAt = null, legacySource = null } = {}) {
    const now = new Date().toISOString();
    const normalizedCreatedAt = getIsoTimestamp(createdAt, now);
    const normalizedUpdatedAt = getIsoTimestamp(updatedAt, normalizedCreatedAt);
    const legacyValue = typeof legacySource === 'string' && legacySource.trim()
        ? legacySource.trim()
        : null;
    return {
        format: DATA_FORMAT_TAG,
        schemaVersion: DATA_SCHEMA_VERSION,
        appVersion: getAppVersionSafe(),
        createdAt: normalizedCreatedAt,
        updatedAt: normalizedUpdatedAt,
        legacySource: legacyValue
    };
}

function normalizeMeta(rawMeta, { legacySource = null } = {}) {
    const source = rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)
        ? rawMeta
        : {};
    const now = new Date().toISOString();
    const createdAt = getIsoTimestamp(source.createdAt, now);
    const updatedAt = getIsoTimestamp(source.updatedAt, createdAt);
    const sourceLegacy = typeof source.legacySource === 'string' && source.legacySource.trim()
        ? source.legacySource.trim()
        : null;
    const forcedLegacy = typeof legacySource === 'string' && legacySource.trim()
        ? legacySource.trim()
        : null;

    return {
        format: DATA_FORMAT_TAG,
        schemaVersion: DATA_SCHEMA_VERSION,
        appVersion: typeof source.appVersion === 'string' && source.appVersion.trim()
            ? source.appVersion.trim()
            : getAppVersionSafe(),
        createdAt,
        updatedAt,
        legacySource: forcedLegacy || sourceLegacy || null
    };
}

function isMetaEnvelopeOutdated(rawMeta) {
    if (!rawMeta || typeof rawMeta !== 'object' || Array.isArray(rawMeta)) {
        return true;
    }

    if (rawMeta.format !== DATA_FORMAT_TAG) return true;
    if (rawMeta.schemaVersion !== DATA_SCHEMA_VERSION) return true;
    if (typeof rawMeta.appVersion !== 'string' || !rawMeta.appVersion.trim()) return true;
    if (!getIsoTimestamp(rawMeta.createdAt)) return true;
    if (!getIsoTimestamp(rawMeta.updatedAt)) return true;
    if (Object.prototype.hasOwnProperty.call(rawMeta, 'tags')) return true;

    return false;
}

function hasLegacyFields(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return false;
    }
    return [
        'tabs',
        'scriptSettings',
        'username',
        'workspaces',
        'autoExecute',
        'preferences'
    ].some((field) => Object.prototype.hasOwnProperty.call(raw, field));
}

function unwrapStoredPayload(rawPayload) {
    if (Array.isArray(rawPayload)) {
        return {
            sourceType: 'legacy-array',
            data: { ...createDefaultData(), tabs: rawPayload },
            meta: null
        };
    }

    if (!rawPayload || typeof rawPayload !== 'object') {
        return {
            sourceType: 'invalid-object',
            data: createDefaultData(),
            meta: null
        };
    }

    const payloadMeta = rawPayload.meta;
    const payloadData = rawPayload.data;
    if (
        payloadData
        && typeof payloadData === 'object'
        && !Array.isArray(payloadData)
        && Object.prototype.hasOwnProperty.call(rawPayload, 'meta')
    ) {
        return {
            sourceType: 'envelope',
            data: payloadData,
            meta: payloadMeta
        };
    }

    if (payloadData && typeof payloadData === 'object' && !Array.isArray(payloadData)) {
        return {
            sourceType: 'legacy-partial-envelope',
            data: payloadData,
            meta: payloadMeta || null
        };
    }

    if (hasLegacyFields(rawPayload)) {
        return {
            sourceType: 'legacy-flat',
            data: rawPayload,
            meta: null
        };
    }

    return {
        sourceType: 'invalid-object',
        data: createDefaultData(),
        meta: null
    };
}

function ensureUniqueId(preferredId, usedIds, fallbackPrefix) {
    const initial = (typeof preferredId === 'string' && preferredId.trim()) ? preferredId.trim() : fallbackPrefix;
    let candidate = initial;
    let index = 2;
    while (usedIds.has(candidate)) {
        candidate = `${initial}-${index}`;
        index += 1;
    }
    usedIds.add(candidate);
    return candidate;
}

function ensureWorkspaceSchema(data) {
    const source = data && typeof data === 'object' ? data : createDefaultData();

    const tabs = Array.isArray(source.tabs) ? source.tabs : [];
    const scriptSettings = normalizeScriptSettings(source.scriptSettings);
    const username = typeof source.username === 'string' && source.username.trim()
        ? source.username.trim()
        : null;
    const autoExecute = source.autoExecute && typeof source.autoExecute === 'object' && !Array.isArray(source.autoExecute)
        ? source.autoExecute
        : {};
    const preferences = normalizePreferences(source.preferences);

    let workspaces = Array.isArray(source.workspaces) ? source.workspaces : [];
    if (workspaces.length === 0) {
        workspaces = [{ id: DEFAULT_WORKSPACE_ID, name: 'scripts', tabOrder: [] }];
    }

    const usedWorkspaceIds = new Set();
    const normalizedWorkspaces = workspaces.map((workspace, index) => {
        const preferredWorkspaceId = typeof workspace?.id === 'string' && workspace.id.trim()
            ? workspace.id.trim()
            : `${DEFAULT_WORKSPACE_ID}-${index + 1}`;
        const workspaceId = ensureUniqueId(preferredWorkspaceId, usedWorkspaceIds, `${DEFAULT_WORKSPACE_ID}-${index + 1}`);
        const workspaceName = typeof workspace?.name === 'string' && workspace.name.trim()
            ? workspace.name.trim()
            : `workspace ${index + 1}`;
        const rawTabOrder = Array.isArray(workspace?.tabOrder)
            ? workspace.tabOrder
            : [];
        const seenOrderIds = new Set();
        const tabOrder = rawTabOrder
            .map((tabId) => (typeof tabId === 'string' ? tabId.trim() : ''))
            .filter((tabId) => {
                if (!tabId || seenOrderIds.has(tabId)) return false;
                seenOrderIds.add(tabId);
                return true;
            });
        return {
            id: workspaceId,
            name: workspaceName,
            tabOrder
        };
    });

    if (normalizedWorkspaces.length === 0) {
        normalizedWorkspaces.push({ id: DEFAULT_WORKSPACE_ID, name: 'scripts', tabOrder: [] });
    }

    const workspaceIds = new Set(normalizedWorkspaces.map((workspace) => workspace.id));
    const firstWorkspaceId = normalizedWorkspaces[0].id;

    const usedTabIds = new Set();
    const normalizedTabs = tabs.map((tab, index) => {
        const preferredTabId = typeof tab?.id === 'string' && tab.id.trim()
            ? tab.id.trim()
            : `tab-${Date.now()}-${index + 1}`;
        const id = ensureUniqueId(preferredTabId, usedTabIds, `tab-${Date.now()}-${index + 1}`);
        const name = typeof tab?.name === 'string' && tab.name.trim() ? tab.name.trim() : `Script ${index + 1}`;
        const content = typeof tab?.content === 'string' ? tab.content : '';
        const requestedWorkspaceId = typeof tab?.workspaceId === 'string' ? tab.workspaceId.trim() : firstWorkspaceId;
        const workspaceId = workspaceIds.has(requestedWorkspaceId) ? requestedWorkspaceId : firstWorkspaceId;
        return {
            id,
            name,
            content,
            workspaceId
        };
    });

    normalizedWorkspaces.forEach((workspace) => {
        const seenValidOrder = new Set();
        const validOrder = workspace.tabOrder.filter((tabId) => {
            if (seenValidOrder.has(tabId)) return false;
            const exists = normalizedTabs.some((tab) => tab.id === tabId && tab.workspaceId === workspace.id);
            if (!exists) return false;
            seenValidOrder.add(tabId);
            return true;
        });
        const missingTabs = normalizedTabs
            .filter((tab) => tab.workspaceId === workspace.id && !validOrder.includes(tab.id))
            .map((tab) => tab.id);
        workspace.tabOrder = [...validOrder, ...missingTabs];
    });

    const validTabIds = new Set(normalizedTabs.map((tab) => tab.id));
    const normalizedAutoExecute = {};
    Object.entries(autoExecute).forEach(([tabId, entry]) => {
        const cleanTabId = typeof tabId === 'string' ? tabId.trim() : '';
        if (!cleanTabId || !validTabIds.has(cleanTabId)) return;
        if (!entry || typeof entry !== 'object') return;

        const serial = Number(entry.serial);
        if (!Number.isFinite(serial) || serial <= 0) return;

        normalizedAutoExecute[cleanTabId] = {
            enabled: Boolean(entry.enabled),
            serial: Math.floor(serial)
        };
    });

    return {
        tabs: normalizedTabs,
        scriptSettings,
        username,
        workspaces: normalizedWorkspaces,
        autoExecute: normalizedAutoExecute,
        preferences
    };
}

function createBackup() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(DATA_DIR, `zyron_app_data_backup_${timestamp}.json`);
            fs.copyFileSync(DATA_FILE, backupFile);
            console.log(`Backup created: ${backupFile}`);
            return { success: true, backupFile };
        }
        return { success: true, backupFile: null };
    } catch (error) {
        console.error('Failed to create backup:', error);
        return { success: false, error: error.message };
    }
}

function createCorruptBackup(fileContent) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(DATA_DIR, `zyron_app_data_corrupt_${timestamp}.json`);
        fs.writeFileSync(backupFile, fileContent, 'utf8');
        console.warn(`Corrupt data backup created: ${backupFile}`);
        return { success: true, backupFile };
    } catch (error) {
        console.error('Failed to create corrupt data backup:', error);
        return { success: false, error: error.message };
    }
}

async function loadAppData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return { success: true, data: null, meta: null };
        }

        const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
        let parsedPayload;
        try {
            parsedPayload = JSON.parse(fileContent);
        } catch (parseError) {
            console.error('Failed to parse app data JSON, attempting recovery:', parseError.message);
            createCorruptBackup(fileContent);

            const recoveredData = createDefaultData();
            const recoveredMeta = buildDefaultMeta({ legacySource: 'corrupt-json' });
            const recoverySaveResult = await saveAppData(recoveredData, {
                meta: recoveredMeta,
                legacySource: 'corrupt-json'
            });
            if (!recoverySaveResult.success) {
                return { success: false, error: recoverySaveResult.error, data: null, meta: null };
            }

            return {
                success: true,
                data: recoveredData,
                meta: recoverySaveResult.meta || recoveredMeta
            };
        }

        const unwrappedPayload = unwrapStoredPayload(parsedPayload);
        const sourceType = unwrappedPayload.sourceType;
        const normalizedData = ensureWorkspaceSchema(unwrappedPayload.data);
        const legacySource = KNOWN_LEGACY_SHAPES.has(sourceType) && sourceType !== 'envelope'
            ? sourceType
            : null;
        const normalizedMeta = normalizeMeta(unwrappedPayload.meta, { legacySource });

        let needsMigration = sourceType !== 'envelope';
        if (!needsMigration) {
            const sourceData = (unwrappedPayload.data && typeof unwrappedPayload.data === 'object')
                ? unwrappedPayload.data
                : {};
            const sourceDataJson = JSON.stringify(sourceData);
            const normalizedDataJson = JSON.stringify(normalizedData);
            if (sourceDataJson !== normalizedDataJson) {
                needsMigration = true;
            }
            if (isMetaEnvelopeOutdated(unwrappedPayload.meta)) {
                needsMigration = true;
            }
        }

        if (needsMigration) {
            console.log('Creating backup before migration...');
            const backupResult = createBackup();
            if (backupResult.success && backupResult.backupFile) {
                console.log(`Backup created at: ${backupResult.backupFile}`);
            }
            
            console.log('Data migration completed. Saving migrated data...');
            const saveResult = await saveAppData(normalizedData, {
                meta: normalizedMeta,
                legacySource: normalizedMeta.legacySource || legacySource || null
            });
            if (!saveResult.success) {
                console.error('Failed to save migrated data:', saveResult.error);
                return { success: false, error: saveResult.error, data: null, meta: null };
            } else {
                console.log('Migrated data saved successfully');
            }

            return {
                success: true,
                data: normalizedData,
                meta: saveResult.meta || normalizedMeta
            };
        }

        return {
            success: true,
            data: normalizedData,
            meta: normalizedMeta
        };
    } catch (error) {
        console.error('Failed to load app data:', error.message);
        return { success: false, error: error.message, data: null, meta: null };
    }
}

async function saveAppData(dataToSave, { meta = null, legacySource = null } = {}) {
    const tempFilePath = `${DATA_FILE}.tmp`;
    try {
        const normalizedData = ensureWorkspaceSchema(dataToSave);
        const normalizedMeta = normalizeMeta(meta, { legacySource });
        normalizedMeta.appVersion = getAppVersionSafe();
        normalizedMeta.updatedAt = new Date().toISOString();

        const payload = {
            meta: normalizedMeta,
            data: normalizedData
        };

        const jsonString = JSON.stringify(payload, null, 4);
        fs.writeFileSync(tempFilePath, jsonString, 'utf8');
        fs.renameSync(tempFilePath, DATA_FILE);
        return {
            success: true,
            message: 'Data saved successfully',
            meta: normalizedMeta
        };
    } catch (error) {
        console.error('Failed to save app data:', error.message);
        try {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        } catch (cleanupError) {
            console.error('Failed cleaning up temp data file:', cleanupError.message);
        }
        return { success: false, error: error.message };
    }
}

ipcMain.handle('load-state', async () => {
    try {
        const result = await loadAppData();
        if (!result.success) {
            return { success: false, error: result.error };
        }
        
        const data = result.data;
        if (!data) {
            const defaults = createDefaultData();
            return {
                success: true,
                tabs: defaults.tabs,
                workspaces: defaults.workspaces,
                autoExecute: defaults.autoExecute
            };
        }
        
        if (!data.tabs || !data.scriptSettings) {
            return { success: false, error: 'Invalid data structure after migration' };
        }
        
        return {
            success: true,
            tabs: data.tabs,
            workspaces: data.workspaces || createDefaultData().workspaces,
            autoExecute: data.autoExecute || {}
        };
    } catch (error) {
        console.error('Error loading state:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('save-state', async (event, payload) => {
    try {
        const existingResult = await loadAppData();
        if (!existingResult.success) {
            return { success: false, error: existingResult.error || 'Failed to load app data before save.' };
        }

        let fullData = existingResult.data;
        let fullMeta = existingResult.meta;
        
        if (!fullData) {
            fullData = createDefaultData();
        }
        if (!fullMeta) {
            fullMeta = buildDefaultMeta();
        }

        const tabsData = Array.isArray(payload)
            ? payload
            : (Array.isArray(payload?.tabs) ? payload.tabs : []);
        const workspacesData = Array.isArray(payload?.workspaces) ? payload.workspaces : fullData.workspaces;
        const autoExecuteData = payload?.autoExecute && typeof payload.autoExecute === 'object'
            ? payload.autoExecute
            : fullData.autoExecute;

        fullData.tabs = tabsData;
        fullData.workspaces = workspacesData;
        fullData.autoExecute = autoExecuteData;
        fullData = ensureWorkspaceSchema(fullData);
        
        const result = await saveAppData(fullData, { meta: fullMeta });
        return result;
    } catch (error) {
        console.error('Error saving state:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-username', async () => {
    try {
        const result = await loadAppData();
        if (!result.success) {
            return { success: false, error: result.error };
        }
        const username = result.data?.username || null;
        return { success: true, username };
    } catch (error) {
        console.error('Error loading username:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('save-username', async (event, username) => {
    try {
        const result = await loadAppData();
        if (!result.success) {
            return { success: false, error: result.error };
        }

        let data = result.data;
        let meta = result.meta;

        if (!data) {
            data = createDefaultData();
        }
        if (!meta) {
            meta = buildDefaultMeta();
        }

        data.username = username;
        const saveResult = await saveAppData(data, { meta });
        return saveResult;
    } catch (error) {
        console.error('Error saving username:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('clear-app-data', async () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            fs.unlinkSync(DATA_FILE);
        }
        return { success: true };
    } catch (error) {
        console.error('Failed to clear app data:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-changelog', async () => {
    try {
        const changelogPath = path.join(__dirname, '..', 'changelog.json');
        const data = fs.readFileSync(changelogPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to read changelog:', error);
        return null;
    }
});

ipcMain.handle('get-app-data-file-size', async () => {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return { success: true, bytes: 0 };
        }
        const stats = fs.statSync(DATA_FILE);
        return { success: true, bytes: Math.max(0, Number(stats.size) || 0) };
    } catch (error) {
        console.error('Failed to read app data file size:', error);
        return { success: false, error: error.message, bytes: 0 };
    }
});

ipcMain.handle('preferences-get-all', async () => {
    try {
        const result = await loadAppData();
        if (!result.success) {
            return { success: false, error: result.error };
        }
        const data = result.data || createDefaultData();
        return {
            success: true,
            preferences: normalizePreferences(data.preferences)
        };
    } catch (error) {
        console.error('Error loading preferences:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('preferences-set-many', async (event, updates) => {
    try {
        const result = await loadAppData();
        if (!result.success) {
            return { success: false, error: result.error };
        }

        const data = result.data || createDefaultData();
        const meta = result.meta || buildDefaultMeta();
        const existingPreferences = normalizePreferences(data.preferences);
        const normalizedUpdates = normalizePreferences(updates);
        data.preferences = {
            ...existingPreferences,
            ...normalizedUpdates
        };

        const saveResult = await saveAppData(ensureWorkspaceSchema(data), { meta });
        return saveResult.success
            ? { success: true, preferences: data.preferences }
            : saveResult;
    } catch (error) {
        console.error('Error saving preferences:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('preferences-set', async (event, key, value) => {
    try {
        if (typeof key !== 'string' || !key.trim()) {
            return { success: false, error: 'Invalid preference key.' };
        }

        const result = await loadAppData();
        if (!result.success) {
            return { success: false, error: result.error };
        }

        const data = result.data || createDefaultData();
        const meta = result.meta || buildDefaultMeta();
        const preferences = normalizePreferences(data.preferences);
        preferences[key] = String(value);
        data.preferences = preferences;

        const saveResult = await saveAppData(ensureWorkspaceSchema(data), { meta });
        return saveResult.success
            ? { success: true, key, value: preferences[key] }
            : saveResult;
    } catch (error) {
        console.error('Error saving preference key:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('preferences-remove', async (event, key) => {
    try {
        if (typeof key !== 'string' || !key.trim()) {
            return { success: false, error: 'Invalid preference key.' };
        }

        const result = await loadAppData();
        if (!result.success) {
            return { success: false, error: result.error };
        }

        const data = result.data || createDefaultData();
        const meta = result.meta || buildDefaultMeta();
        const preferences = normalizePreferences(data.preferences);
        delete preferences[key];
        data.preferences = preferences;

        const saveResult = await saveAppData(ensureWorkspaceSchema(data), { meta });
        return saveResult.success
            ? { success: true, key }
            : saveResult;
    } catch (error) {
        console.error('Error removing preference key:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('preferences-clear', async () => {
    try {
        const result = await loadAppData();
        if (!result.success) {
            return { success: false, error: result.error };
        }

        const data = result.data || createDefaultData();
        const meta = result.meta || buildDefaultMeta();
        data.preferences = {};

        const saveResult = await saveAppData(ensureWorkspaceSchema(data), { meta });
        return saveResult.success ? { success: true } : saveResult;
    } catch (error) {
        console.error('Error clearing preferences:', error);
        return { success: false, error: error.message };
    }
});

function resolveScriptSettingKeys(scriptRef) {
    if (scriptRef && typeof scriptRef === 'object') {
        const scriptId = typeof scriptRef.scriptId === 'string' ? scriptRef.scriptId.trim() : '';
        const scriptName = typeof scriptRef.scriptName === 'string' ? scriptRef.scriptName.trim() : '';
        const primaryKey = scriptId || scriptName;
        const fallbackKeys = [];
        if (scriptName && scriptName !== primaryKey) {
            fallbackKeys.push(scriptName);
        }
        return { primaryKey, fallbackKeys };
    }

    const scriptName = typeof scriptRef === 'string' ? scriptRef.trim() : '';
    return { primaryKey: scriptName, fallbackKeys: [] };
}

ipcMain.handle('save-script-settings', async (event, scriptRef, settings) => {
    try {
        const result = await loadAppData();
        if (!result.success) {
            return { success: false, error: result.error };
        }

        let data = result.data;
        let meta = result.meta;
        
        if (!data) {
            data = createDefaultData();
        }
        if (!meta) {
            meta = buildDefaultMeta();
        }
        
        if (!data.scriptSettings) {
            data.scriptSettings = {};
        }

        const { primaryKey, fallbackKeys } = resolveScriptSettingKeys(scriptRef);
        if (!primaryKey) {
            return { success: false, error: 'Invalid script reference.' };
        }

        data.scriptSettings[primaryKey] = settings;
        fallbackKeys.forEach((key) => {
            if (key && key !== primaryKey && data.scriptSettings[key]) {
                delete data.scriptSettings[key];
            }
        });
        
        const saveResult = await saveAppData(data, { meta });
        return saveResult;
    } catch (error) {
        console.error('Error saving script settings:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-script-settings', async (event, scriptRef) => {
    try {
        const result = await loadAppData();
        if (!result.success || !result.data) {
            return { success: true, settings: null };
        }

        const { primaryKey, fallbackKeys } = resolveScriptSettingKeys(scriptRef);
        if (!primaryKey) {
            return { success: true, settings: null };
        }

        let settings = result.data.scriptSettings?.[primaryKey] || null;
        if (!settings) {
            for (const key of fallbackKeys) {
                if (!key) continue;
                settings = result.data.scriptSettings?.[key] || null;
                if (settings) break;
            }
        }

        return { success: true, settings };
    } catch (error) {
        console.error('Error loading script settings:', error);
        return { success: false, error: error.message };
    }
});

function initialize() {
}

module.exports = {
    initialize,
    loadAppData,
    saveAppData,
    DATA_DIR,
    DATA_FILE
};
