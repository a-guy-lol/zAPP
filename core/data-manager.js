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

if (!isDevelopment && !fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
} else if (isDevelopment && !fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
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
    if (!rawPreferences || typeof rawPreferences !== 'object') {
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

function ensureWorkspaceSchema(data) {
    const source = data && typeof data === 'object' ? data : createDefaultData();

    const tabs = Array.isArray(source.tabs) ? source.tabs : [];
    const scriptSettings = source.scriptSettings && typeof source.scriptSettings === 'object'
        ? source.scriptSettings
        : {};
    const username = Object.prototype.hasOwnProperty.call(source, 'username') ? source.username : null;
    const autoExecute = source.autoExecute && typeof source.autoExecute === 'object'
        ? source.autoExecute
        : {};
    const preferences = normalizePreferences(source.preferences);

    let workspaces = Array.isArray(source.workspaces) ? source.workspaces : [];
    if (workspaces.length === 0) {
        workspaces = [{ id: DEFAULT_WORKSPACE_ID, name: 'scripts', tabOrder: [] }];
    }

    const normalizedWorkspaces = workspaces.map((workspace, index) => {
        const workspaceId = typeof workspace?.id === 'string' && workspace.id.trim()
            ? workspace.id.trim()
            : `${DEFAULT_WORKSPACE_ID}-${index}`;
        const workspaceName = typeof workspace?.name === 'string' && workspace.name.trim()
            ? workspace.name.trim()
            : `workspace ${index + 1}`;
        const tabOrder = Array.isArray(workspace?.tabOrder)
            ? workspace.tabOrder.filter((tabId) => typeof tabId === 'string')
            : [];
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

    const normalizedTabs = tabs.map((tab, index) => {
        const id = typeof tab?.id === 'string' && tab.id.trim() ? tab.id.trim() : `tab-${Date.now()}-${index}`;
        const name = typeof tab?.name === 'string' && tab.name.trim() ? tab.name.trim() : `Script ${index + 1}`;
        const content = typeof tab?.content === 'string' ? tab.content : '';
        const requestedWorkspaceId = typeof tab?.workspaceId === 'string' ? tab.workspaceId : firstWorkspaceId;
        const workspaceId = workspaceIds.has(requestedWorkspaceId) ? requestedWorkspaceId : firstWorkspaceId;
        return {
            id,
            name,
            content,
            workspaceId
        };
    });

    normalizedWorkspaces.forEach((workspace) => {
        const validOrder = workspace.tabOrder.filter((tabId) => normalizedTabs.some((tab) => tab.id === tabId));
        const missingTabs = normalizedTabs
            .filter((tab) => tab.workspaceId === workspace.id && !validOrder.includes(tab.id))
            .map((tab) => tab.id);
        workspace.tabOrder = [...validOrder, ...missingTabs];
    });

    return {
        tabs: normalizedTabs,
        scriptSettings,
        username,
        workspaces: normalizedWorkspaces,
        autoExecute,
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

async function loadAppData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return { success: true, data: null };
        }
        const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
        let data = JSON.parse(fileContent);
        
        let needsMigration = false;
        
        if (Array.isArray(data)) {
            console.log('Migrating from legacy array format to new structure...');
            data = { ...createDefaultData(), tabs: data };
            needsMigration = true;
        } else if (data && typeof data === 'object' && data.tabs && !data.scriptSettings) {
            console.log('Migrating from v1.2 format to v1.3 format...');
            data.scriptSettings = {};
            if (!Object.prototype.hasOwnProperty.call(data, 'username')) {
                data.username = null;
            }
            needsMigration = true;
        } else if (data && typeof data === 'object' && !data.tabs && !data.scriptSettings) {
            console.log('Initializing empty data structure...');
            data = createDefaultData();
            needsMigration = true;
        } else if (data && typeof data === 'object' && !Object.prototype.hasOwnProperty.call(data, 'username')) {
            data.username = null;
            needsMigration = true;
        }

        const normalizedData = ensureWorkspaceSchema(data);
        const normalizedJson = JSON.stringify(normalizedData);
        const sourceJson = JSON.stringify(data || {});
        if (normalizedJson !== sourceJson) {
            data = normalizedData;
            needsMigration = true;
        } else {
            data = normalizedData;
        }
        
        if (needsMigration) {
            console.log('Creating backup before migration...');
            const backupResult = createBackup();
            if (backupResult.success && backupResult.backupFile) {
                console.log(`Backup created at: ${backupResult.backupFile}`);
            }
            
            console.log('Data migration completed. Saving migrated data...');
            const saveResult = await saveAppData(data);
            if (!saveResult.success) {
                console.error('Failed to save migrated data:', saveResult.error);
            } else {
                console.log('Migrated data saved successfully');
            }
        }
        
        return { success: true, data };
    } catch (error) {
        console.error('Failed to load app data:', error.message);
        return { success: false, error: error.message, data: null };
    }
}

async function saveAppData(dataToSave) {
    try {
        const jsonString = JSON.stringify(dataToSave, null, 4);
        fs.writeFileSync(DATA_FILE, jsonString, 'utf8');
        return { success: true, message: 'Data saved successfully' };
    } catch (error) {
        console.error('Failed to save app data:', error.message);
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
        let fullData = existingResult.data;
        
        if (!fullData) {
            fullData = createDefaultData();
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
        
        const result = await saveAppData(fullData);
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
        let data = result.data;

        if (!data) {
            data = createDefaultData();
        }

        data.username = username;
        const saveResult = await saveAppData(data);
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
        const existingPreferences = normalizePreferences(data.preferences);
        const normalizedUpdates = normalizePreferences(updates);
        data.preferences = {
            ...existingPreferences,
            ...normalizedUpdates
        };

        const saveResult = await saveAppData(ensureWorkspaceSchema(data));
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
        const preferences = normalizePreferences(data.preferences);
        preferences[key] = String(value);
        data.preferences = preferences;

        const saveResult = await saveAppData(ensureWorkspaceSchema(data));
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
        const preferences = normalizePreferences(data.preferences);
        delete preferences[key];
        data.preferences = preferences;

        const saveResult = await saveAppData(ensureWorkspaceSchema(data));
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
        data.preferences = {};

        const saveResult = await saveAppData(ensureWorkspaceSchema(data));
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
        let data = result.data;
        
        if (!data) {
            data = createDefaultData();
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
        
        const saveResult = await saveAppData(data);
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
