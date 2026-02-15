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
    document.getElementById('rename-modal-title').textContent = 'Change Name';
    renameModalInput.value = (sideProfileName && sideProfileName.textContent.trim()) || window.safeStorage.getItem('zyronUsername') || '';
    renameModalOverlay.classList.remove('hidden');
    renameModalInput.focus();
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
