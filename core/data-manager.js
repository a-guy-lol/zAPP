const fs = require('fs');
const path = require('path');
const os = require('os');
const { ipcMain, app } = require('electron');

const isDevelopment = !app.isPackaged;

const DATA_DIR = isDevelopment 
    ? path.join(__dirname, '..', 'dev-data') 
    : path.join(os.homedir(), 'Documents', 'zyronData');
const DATA_FILE = path.join(DATA_DIR, 'zyron_app_data.json');

if (!isDevelopment && !fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
} else if (isDevelopment && !fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
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
            data = {
                tabs: data,
                scriptSettings: {}
            };
            needsMigration = true;
        } else if (data && typeof data === 'object' && data.tabs && !data.scriptSettings) {
            console.log('Migrating from v1.2 format to v1.3 format...');
            data.scriptSettings = {};
            needsMigration = true;
        } else if (data && typeof data === 'object' && !data.tabs && !data.scriptSettings) {
            console.log('Initializing empty data structure...');
            data = {
                tabs: [],
                scriptSettings: {}
            };
            needsMigration = true;
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
            return { success: true, tabs: [] };
        }
        
        if (!data.tabs || !data.scriptSettings) {
            return { success: false, error: 'Invalid data structure after migration' };
        }
        
        return { success: true, tabs: data.tabs };
    } catch (error) {
        console.error('Error loading state:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('save-state', async (event, tabsData) => {
    try {
        const existingResult = await loadAppData();
        let fullData = existingResult.data;
        
        if (!fullData) {
            fullData = {
                tabs: [],
                scriptSettings: {}
            };
        }
        
        fullData.tabs = tabsData;
        
        const result = await saveAppData(fullData);
        return result;
    } catch (error) {
        console.error('Error saving state:', error);
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

ipcMain.handle('save-script-settings', async (event, scriptName, settings) => {
    try {
        const result = await loadAppData();
        let data = result.data;
        
        if (!data) {
            data = {
                tabs: [],
                scriptSettings: {}
            };
        }
        
        if (!data.scriptSettings) {
            data.scriptSettings = {};
        }
        
        data.scriptSettings[scriptName] = settings;
        
        const saveResult = await saveAppData(data);
        return saveResult;
    } catch (error) {
        console.error('Error saving script settings:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-script-settings', async (event, scriptName) => {
    try {
        const result = await loadAppData();
        if (!result.success || !result.data) {
            return { success: true, settings: null };
        }
        
        const settings = result.data.scriptSettings?.[scriptName] || null;
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
