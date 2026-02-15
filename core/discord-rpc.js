const DiscordRPC = require('discord-rpc');
const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');

const clientId = '1385844569052151944';
let rpc = new DiscordRPC.Client({ transport: 'ipc' });
let rpcStartTime = new Date();
let presenceUpdateInterval;
let rpcEnabled = true;
let currentActiveScriptTabName = 'No Script Open';
let isHydrogenConnected = false;
const RPC_PREFS_FILE = 'discord-rpc-preferences.json';

function getPrefsFilePath() {
    return path.join(app.getPath('userData'), RPC_PREFS_FILE);
}

function loadRpcEnabledPreference() {
    try {
        const filePath = getPrefsFilePath();
        if (!fs.existsSync(filePath)) {
            return true;
        }
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (typeof parsed?.enabled === 'boolean') {
            return parsed.enabled;
        }
    } catch (error) {
        console.error('Failed to load Discord RPC preference:', error.message);
    }
    return true;
}

function saveRpcEnabledPreference(enabled) {
    try {
        fs.writeFileSync(getPrefsFilePath(), JSON.stringify({ enabled: Boolean(enabled) }), 'utf8');
    } catch (error) {
        console.error('Failed to save Discord RPC preference:', error.message);
    }
}

async function setDiscordActivity(activityDetails = {}) {
    if (!rpc) {
        return;
    }

    let stateText = '';
    if (isHydrogenConnected) {
        stateText = 'Connected to Roblox';
    } else {
        stateText = 'Disconnected';
    }

    const activity = {
        details: `✧ Editing ${currentActiveScriptTabName}.lua ✧`,
        state: stateText,
        startTimestamp: rpcStartTime,
        largeImageText: 'Zyron Editor',
        largeImageKey: 'zyron_icon',
        instance: false,
    };

    if (isHydrogenConnected) {
        activity.smallImageKey = 'roblox-icon';
        activity.smallImageText = 'Connected';
    }

    try {
        await rpc.setActivity({ ...activity, ...activityDetails });
    } catch (error) {
        console.error('Failed to set Discord Rich Presence:', error);
    }
}

function setup() {
    if (!rpcEnabled) return;
    
    if (!rpc) {
        rpc = new DiscordRPC.Client({ transport: 'ipc' });
    }

    rpc.on('ready', () => {
        setDiscordActivity();
        if (presenceUpdateInterval) clearInterval(presenceUpdateInterval);
        presenceUpdateInterval = setInterval(() => {
            setDiscordActivity();
        }, 15 * 1000);
    });

    rpc.on('disconnected', () => {
        clearInterval(presenceUpdateInterval);
    });

    rpc.login({ clientId })
        .catch(error => {
            console.error('Failed to connect to Discord Rich Presence:', error);
            rpc = null;
        });
}

function shutdown() {
    if (!rpc) return;
    clearInterval(presenceUpdateInterval);
    rpc.destroy().catch(console.error);
    rpc = null;
}

ipcMain.handle('toggle-discord-rpc', (event, isEnabled) => {
    rpcEnabled = isEnabled;
    saveRpcEnabledPreference(rpcEnabled);
    if (isEnabled) {
        setup();
    } else {
        shutdown();
    }
    return rpcEnabled;
});

ipcMain.handle('get-discord-rpc-status', () => {
    return rpcEnabled;
});

ipcMain.on('update-active-script-name', (event, scriptName) => {
    if (currentActiveScriptTabName !== scriptName) {
        currentActiveScriptTabName = scriptName;
        setDiscordActivity();
    }
});

function initialize() {
    rpcEnabled = loadRpcEnabledPreference();
}

function updateConnectionStatus(connected) {
    if (isHydrogenConnected !== connected) {
        isHydrogenConnected = connected;
        setDiscordActivity();
    }
}

function updateActivity(details = {}) {
    setDiscordActivity(details);
}

module.exports = {
    initialize,
    setup,
    shutdown,
    updateConnectionStatus,
    updateActivity
};
