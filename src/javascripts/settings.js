function initializeSettingsTabs() {
    const tabs = document.querySelectorAll('.settings-tab');
    const panels = document.querySelectorAll('.settings-panel');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`${targetTab}-settings`).classList.add('active');
        });
    });
}

function toggleAnimations() {
    const enabled = document.getElementById('animations-toggle').checked;
    window.safeStorage.setItem('zyronAnimations', enabled);
    
    if (enabled) {
        document.body.classList.remove('no-animations');
    } else {
        document.body.classList.add('no-animations');
    }
}

function applyNavSpeed(speedValue) {
    const speedMap = {
        1: { expand: '0.38s', label: '0.3s', color: '0.24s' },  // Slow (slowest)
        2: { expand: '0.28s', label: '0.22s', color: '0.22s' }, // Medium (old slow)
        3: { expand: '0.16s', label: '0.14s', color: '0.16s' }  // Fast
    };

    const parsed = Number(speedValue);
    const speed = speedMap[parsed] || speedMap[2];

    document.documentElement.style.setProperty('--nav-expand-duration', speed.expand);
    document.documentElement.style.setProperty('--nav-label-duration', speed.label);
    document.documentElement.style.setProperty('--nav-color-duration', speed.color);
}

function toggleNavMotion() {
    const enabled = navMotionToggle.checked;
    window.safeStorage.setItem('zyronNavMotion', enabled);
    navSpeedSlider.disabled = !enabled;

    if (enabled) {
        document.body.classList.remove('no-nav-motion');
    } else {
        document.body.classList.add('no-nav-motion');
    }
}

function updateNavSpeed() {
    const speedValue = Number(navSpeedSlider.value) || 2;
    window.safeStorage.setItem('zyronNavSpeed', speedValue);
    applyNavSpeed(speedValue);
}

function getFallbackEditorPreferences() {
    const readBoolean = (key, fallback) => {
        const raw = window.safeStorage.getItem(key);
        if (raw === null || typeof raw === 'undefined') return fallback;
        return String(raw) !== 'false';
    };

    const fallbackSize = Number(window.safeStorage.getItem('zyronEditorFontSize'));
    return {
        fontSize: Number.isFinite(fallbackSize) ? fallbackSize : 14,
        lineNumbers: readBoolean('zyronEditorLineNumbers', true),
        highlightActiveLine: readBoolean('zyronEditorActiveLine', true),
        lineWrap: readBoolean('zyronEditorLineWrap', false),
        autocomplete: readBoolean('zyronEditorAutocomplete', true)
    };
}

function getEditorPreferencesForUI() {
    if (typeof window.getEditorPreferences === 'function') {
        return window.getEditorPreferences();
    }
    return getFallbackEditorPreferences();
}

function setEditorPreferencesFromUI(partialPreferences) {
    const nextPreferences = {
        ...getEditorPreferencesForUI(),
        ...partialPreferences
    };

    if (typeof window.setEditorPreferences === 'function') {
        return window.setEditorPreferences(nextPreferences);
    }

    window.safeStorage.setItem('zyronEditorFontSize', nextPreferences.fontSize);
    window.safeStorage.setItem('zyronEditorLineNumbers', nextPreferences.lineNumbers);
    window.safeStorage.setItem('zyronEditorActiveLine', nextPreferences.highlightActiveLine);
    window.safeStorage.setItem('zyronEditorLineWrap', nextPreferences.lineWrap);
    window.safeStorage.setItem('zyronEditorAutocomplete', nextPreferences.autocomplete);
    return nextPreferences;
}

function updateEditorSizeValue(sizeValue) {
    if (!editorSizeValue) return;
    const numeric = Number(sizeValue);
    editorSizeValue.textContent = Number.isFinite(numeric) ? `${Math.round(numeric)}px` : '14px';
}

function updateEditorSizeSetting() {
    const min = Number(window.EDITOR_FONT_SIZE_MIN) || 11;
    const max = Number(window.EDITOR_FONT_SIZE_MAX) || 18;
    const rawValue = Number(editorSizeSlider.value);
    const clamped = Math.max(min, Math.min(max, Number.isFinite(rawValue) ? rawValue : 14));
    editorSizeSlider.value = String(clamped);
    setEditorPreferencesFromUI({ fontSize: clamped });
    updateEditorSizeValue(clamped);
}

function toggleEditorLineNumbers() {
    setEditorPreferencesFromUI({ lineNumbers: editorLineNumbersToggle.checked });
}

function toggleEditorActiveLine() {
    setEditorPreferencesFromUI({ highlightActiveLine: editorActiveLineToggle.checked });
}

function toggleEditorAutocomplete() {
    setEditorPreferencesFromUI({ autocomplete: editorAutocompleteToggle.checked });
}

function toggleEditorLineWrap() {
    setEditorPreferencesFromUI({ lineWrap: editorLineWrapToggle.checked });
}

function applyEditorSettingsFromStorage() {
    let preferences;
    if (typeof window.loadEditorPreferencesFromStorage === 'function') {
        preferences = window.loadEditorPreferencesFromStorage();
    } else {
        preferences = getFallbackEditorPreferences();
    }

    editorSizeSlider.value = String(preferences.fontSize);
    editorLineNumbersToggle.checked = preferences.lineNumbers;
    editorActiveLineToggle.checked = preferences.highlightActiveLine;
    editorAutocompleteToggle.checked = preferences.autocomplete;
    editorLineWrapToggle.checked = preferences.lineWrap;
    updateEditorSizeValue(preferences.fontSize);
}

window.applyEditorSettingsFromStorage = applyEditorSettingsFromStorage;

function toggleEffects() {
    const enabled = document.getElementById('effects-toggle').checked;
    window.safeStorage.setItem('zyronEffects', enabled);
    
    if (enabled) {
        document.body.classList.remove('no-effects');
    } else {
        document.body.classList.add('no-effects');
    }
}

function toggleSaveIndicator() {
    const enabled = document.getElementById('save-indicator-toggle').checked;
    window.safeStorage.setItem('zyronSaveIndicator', enabled);
}

function togglePerformanceMode() {
    const enabled = performanceModeToggle.checked;
    window.safeStorage.setItem('zyronPerfMode', enabled);
    
    if (enabled) {
        document.body.classList.add('performance-mode');
    } else {
        document.body.classList.remove('performance-mode');
    }
}

function toggleNotifications() {
    notificationsEnabled = notificationsToggle.checked;
    window.safeStorage.setItem('zyronNotifications', notificationsEnabled);
    showNotification(
        notificationsEnabled ? 'Notifications enabled' : 'Notifications disabled', 
        'info'
    );
}

async function toggleRobloxConsoleLogging() {
    const enabled = rbxConsoleLoggingToggle.checked;
    window.safeStorage.setItem('zyronRbxConsoleLogging', enabled);

    if (typeof window.syncConsoleBridgeState === 'function') {
        await window.syncConsoleBridgeState({ notifyOnError: true });
    }
}

function handleRenameUser() {
    if (typeof window.clearRenameContext === 'function') {
        window.clearRenameContext();
    }
    document.getElementById('rename-modal-title').textContent = 'Change Name';
    renameModalInput.value = (sideProfileName && sideProfileName.textContent.trim()) || window.safeStorage.getItem('zyronUsername') || '';
    renameModalInput.maxLength = 32;
    renameModalOverlay.classList.remove('hidden');
    renameModalInput.focus();
    renameModalInput.select();
}

async function confirmClearData() {
    try {
        const cleanupScripts = TABS_DATA
            .map((tab) => {
                const entry = AUTOEXECUTE_DATA?.[tab.id];
                if (!entry || !entry.serial) return null;
                return {
                    id: tab.id,
                    serial: entry.serial,
                    enabled: false,
                    content: ''
                };
            })
            .filter(Boolean);
        if (cleanupScripts.length > 0 && window.electronAPI?.syncAutoexecuteScripts) {
            await window.electronAPI.syncAutoexecuteScripts({
                executor: selectedExecutor,
                scripts: cleanupScripts
            });
        }

        const result = await window.electronAPI.clearAppData();
        if (result.success) {
            window.safeStorage.removeItem('zyronUsername');
            window.safeStorage.removeItem('zyronLastActiveTab');
            window.safeStorage.removeItem('zyronPerfMode');
            window.safeStorage.removeItem('zyronNotifications');
            window.safeStorage.removeItem('zyronNavMotion');
            window.safeStorage.removeItem('zyronNavSpeed');
            window.safeStorage.removeItem('zyronExecutor');
            window.safeStorage.removeItem('zyronRbxConsoleLogging');
            window.safeStorage.removeItem('zyronRbxConsoleAccepted');
            window.safeStorage.removeItem('zyronProfileAvatarId');
            window.safeStorage.removeItem('zyronNotificationHistory');
            window.safeStorage.removeItem('zyronAvatarSalt');
            window.safeStorage.removeItem('zyronActiveWorkspaceId');
            window.safeStorage.removeItem('zyronAutoExecuteFolderCollapse');
            window.safeStorage.removeItem('zyronDiscordRpc');
            window.safeStorage.removeItem('zyronEditorFontSize');
            window.safeStorage.removeItem('zyronEditorLineNumbers');
            window.safeStorage.removeItem('zyronEditorActiveLine');
            window.safeStorage.removeItem('zyronEditorLineWrap');
            window.safeStorage.removeItem('zyronEditorAutocomplete');
            window.safeStorage.removeItem('zyronKillSwitch');
            if (typeof window.safeStorageFlush === 'function') {
                await window.safeStorageFlush();
            }

            if (typeof window.syncConsoleBridgeState === 'function') {
                await window.syncConsoleBridgeState({ notifyOnError: false, forceDisable: true });
            }
            showNotification('All app data cleared successfully!', 'info');
            setTimeout(() => location.reload(), 1000);
        } else {
            showNotification(`Failed to clear data: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error clearing data:', error);
        showNotification('Failed to clear app data', 'error');
    }
}

function toggleDiscordRpc() {
    const isEnabled = discordRpcToggle.checked;
    window.safeStorage.setItem('zyronDiscordRpc', isEnabled);
    window.electronAPI.toggleDiscordRpc(isEnabled);
}
