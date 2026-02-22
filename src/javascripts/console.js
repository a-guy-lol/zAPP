let consoleAccepted = false;
let consoleLastSeq = 0;
let consolePollInterval = null;
let consoleInitialized = false;
const MAX_RENDERED_CONSOLE_LINES = 2000;
let consoleAutoFollow = true;
let totalConsoleLogs = 0;
let errorConsoleLogs = 0;
let warnConsoleLogs = 0;

function normalizeConsoleLevel(type) {
    const raw = String(type || '').toLowerCase();
    if (raw.includes('error')) return 'error';
    if (raw.includes('warn')) return 'warn';
    return 'info';
}

function formatConsoleTime(isoString) {
    const date = isoString ? new Date(isoString) : new Date();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function renderConsolePlaceholder(text) {
    if (!consoleLogList) return;
    if (consoleLogList.querySelector('.console-line')) return;

    const existing = consoleLogList.querySelector('.console-placeholder');
    if (existing) existing.remove();

    const placeholder = document.createElement('div');
    placeholder.className = 'console-placeholder';
    placeholder.textContent = text;
    consoleLogList.appendChild(placeholder);
}

function clearConsolePlaceholder() {
    if (!consoleLogList) return;
    const placeholder = consoleLogList.querySelector('.console-placeholder');
    if (placeholder) placeholder.remove();
}

function appendConsoleLine(entry) {
    const level = normalizeConsoleLevel(entry.type);

    const line = document.createElement('div');
    line.className = `console-line ${level}`;
    line.innerHTML = `
        <span class="console-time">${formatConsoleTime(entry.receivedAt)}</span>
        <span class="console-level ${level}">${String(entry.type || 'INFO').toUpperCase()}</span>
        <span class="console-message"></span>
    `;
    line.querySelector('.console-message').textContent = String(entry.message || '');

    const placeholder = consoleLogList.querySelector('.console-placeholder');
    if (placeholder) placeholder.remove();

    consoleLogList.appendChild(line);

    totalConsoleLogs += 1;
    if (level === 'error') {
        errorConsoleLogs += 1;
    } else if (level === 'warn') {
        warnConsoleLogs += 1;
    }
    emitConsoleMetricsUpdate();

    while (consoleLogList.children.length > MAX_RENDERED_CONSOLE_LINES) {
        consoleLogList.removeChild(consoleLogList.firstElementChild);
    }
}

function emitConsoleMetricsUpdate() {
    if (typeof window.updateConsoleSidePanelInfo === 'function') {
        window.updateConsoleSidePanelInfo();
    }
}

function isConsoleNearBottom() {
    return consoleLogList.scrollTop + consoleLogList.clientHeight >= consoleLogList.scrollHeight - 8;
}

async function pullConsoleLogs() {
    const shouldPoll = consoleAccepted && rbxConsoleLoggingToggle.checked;
    if (!shouldPoll) return;

    const shouldStickToBottom = consoleAutoFollow || isConsoleNearBottom();

    try {
        const result = await window.electronAPI.consoleGetLogs(consoleLastSeq);
        if (!result.success || !Array.isArray(result.logs)) return;

        result.logs.forEach((logEntry) => appendConsoleLine(logEntry));
        consoleLastSeq = Number(result.nextSeq) || consoleLastSeq;

        if (result.logs.length > 0 && shouldStickToBottom) {
            consoleLogList.scrollTop = consoleLogList.scrollHeight;
            consoleAutoFollow = true;
        }
    } catch (error) {
        console.error('Failed to pull console logs:', error);
    }
}

function startConsolePolling() {
    if (consolePollInterval) return;
    pullConsoleLogs();
    consolePollInterval = setInterval(pullConsoleLogs, 200);
}

function stopConsolePolling() {
    if (!consolePollInterval) return;
    clearInterval(consolePollInterval);
    consolePollInterval = null;
}

function updateConsoleAccessUI() {
    const loggingEnabled = rbxConsoleLoggingToggle.checked;
    const killSwitchBlocked = Boolean(killSwitchEnabled);
    const canUseConsole = consoleAccepted && loggingEnabled && !killSwitchBlocked;

    consoleConsentBanner.classList.toggle('hidden', consoleAccepted);
    consoleDisabledBanner.classList.toggle('hidden', !consoleAccepted || loggingEnabled);
    if (consoleClearBtn) {
        consoleClearBtn.disabled = !canUseConsole;
    }

    if (!consoleAccepted) {
        stopConsolePolling();
        renderConsolePlaceholder('Accept the notice above to start using Roblox console in this tab.');
        emitConsoleMetricsUpdate();
        return;
    }

    if (!loggingEnabled) {
        stopConsolePolling();
        renderConsolePlaceholder('Turn on Roblox Console Logging in Settings to stream logs here.');
        emitConsoleMetricsUpdate();
        return;
    }

    if (killSwitchBlocked) {
        stopConsolePolling();
        renderConsolePlaceholder('Kill Switch is enabled. Console bridge is disabled.');
        emitConsoleMetricsUpdate();
        return;
    }

    clearConsolePlaceholder();
    startConsolePolling();
    emitConsoleMetricsUpdate();
}

async function syncConsoleBridgeState({ notifyOnError = false, forceDisable = false } = {}) {
    const killSwitchBlocked = Boolean(killSwitchEnabled);
    const shouldDisable = forceDisable || killSwitchBlocked;
    const enabled = shouldDisable ? false : rbxConsoleLoggingToggle.checked;
    const accepted = shouldDisable ? false : consoleAccepted;

    try {
        const result = await window.electronAPI.consoleSetConfig({
            enabled,
            accepted,
            executor: selectedExecutor
        });

        if (!result.success && notifyOnError && result.error) {
            showNotification(result.error, 'error');
        }

        updateConsoleAccessUI();
        return result;
    } catch (error) {
        if (notifyOnError) {
            showNotification(`Failed to sync console bridge: ${error.message}`, 'error');
        }
        updateConsoleAccessUI();
        return { success: false, error: error.message };
    }
}

async function onExecutorSelectionChanged() {
    await syncConsoleBridgeState({ notifyOnError: true });
}

async function handleConsoleShowPath() {
    try {
        const result = await window.electronAPI.consoleOpenAutoexecPath(selectedExecutor);
        if (!result.success) {
            showNotification(result.error || "Autoexecute folder doesn't exist for the selected executor.", 'error');
        }
    } catch (error) {
        showNotification(`Failed to open autoexecute path: ${error.message}`, 'error');
    }
}

async function handleConsoleAccept() {
    consoleAccepted = true;
    window.safeStorage.setItem('zyronRbxConsoleAccepted', 'true');
    consoleConsentBanner.classList.add('hidden');
    updateConsoleAccessUI();
    await syncConsoleBridgeState({ notifyOnError: true });
}

async function handleConsoleClear() {
    if (!consoleAccepted || !rbxConsoleLoggingToggle.checked) {
        updateConsoleAccessUI();
        return;
    }

    try {
        await window.electronAPI.consoleClearLogs();
    } catch (error) {
        showNotification(`Failed to clear console logs: ${error.message}`, 'error');
        return;
    }

    consoleLastSeq = 0;
    consoleLogList.innerHTML = '';
    totalConsoleLogs = 0;
    errorConsoleLogs = 0;
    warnConsoleLogs = 0;

    updateConsoleAccessUI();
}

function onConsoleViewShown() {
    updateConsoleAccessUI();
    pullConsoleLogs();
}

function initializeConsoleTab() {
    if (consoleInitialized) return;
    consoleInitialized = true;

    const applyInitialConsolePreference = async () => {
        if (window.safeStorageReady && typeof window.safeStorageReady.then === 'function') {
            try {
                await window.safeStorageReady;
            } catch (error) {
                console.error('Failed to initialize preference storage for console:', error);
            }
        }
        consoleAccepted = window.safeStorage.getItem('zyronRbxConsoleAccepted') === 'true';
        updateConsoleAccessUI();
        syncConsoleBridgeState({ notifyOnError: false });
    };

    consoleShowPathBtn.addEventListener('click', handleConsoleShowPath);
    consoleAcceptBtn.addEventListener('click', handleConsoleAccept);
    consoleClearBtn.addEventListener('click', handleConsoleClear);
    consoleLogList.addEventListener('scroll', () => {
        consoleAutoFollow = isConsoleNearBottom();
    });

    applyInitialConsolePreference();
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeConsoleTab, 120);
});

window.syncConsoleBridgeState = syncConsoleBridgeState;
window.onExecutorSelectionChanged = onExecutorSelectionChanged;
window.onConsoleViewShown = onConsoleViewShown;
window.getConsoleMetrics = function getConsoleMetrics() {
    const killSwitchBlocked = Boolean(killSwitchEnabled);
    return {
        active: Boolean(consoleAccepted && rbxConsoleLoggingToggle.checked && !killSwitchBlocked),
        totalLogs: totalConsoleLogs,
        errorLogs: errorConsoleLogs,
        warnLogs: warnConsoleLogs
    };
};
