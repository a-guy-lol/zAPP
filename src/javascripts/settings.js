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

async function toggleZexiumAPI() {
    const isEnabled = zexiumApiToggle.checked;
    try {
        await window.electronAPI.toggleZexiumAPI(isEnabled);
        isZexiumAPIEnabled = isEnabled;
        
        window.safeStorage.setItem('zyronZexiumAPI', isEnabled);
        
        showNotification(
            isZexiumAPIEnabled ? 'Zexium API enabled' : 'Zexium API disabled', 
            'info'
        );
    
        checkConnection();
    } catch (error) {
        console.error('Failed to toggle Zexium API:', error);
        zexiumApiToggle.checked = !isEnabled;
        showNotification('Failed to toggle Zexium API', 'error');
    }
}

function handleRenameUser() {
    document.getElementById('rename-modal-title').textContent = 'Change Name';
    renameModalInput.value = window.safeStorage.getItem('zyronUsername') || '';
    renameModalOverlay.classList.remove('hidden');
    renameModalInput.focus();
}

async function confirmClearData() {
    try {
        const result = await window.electronAPI.clearAppData();
        if (result.success) {
            window.safeStorage.removeItem('zyronUsername');
            window.safeStorage.removeItem('zyronLastActiveTab');
            window.safeStorage.removeItem('zyronPerfMode');
            window.safeStorage.removeItem('zyronNotifications');
            window.safeStorage.removeItem('zyronZexiumAPI');
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
    window.electronAPI.toggleDiscordRpc(isEnabled);
}

async function toggleZexiumAPI() {
    const isEnabled = zexiumApiToggle.checked;
    try {
        const result = await window.electronAPI.toggleZexiumAPI(isEnabled);
        if (result.success) {
            isZexiumAPIEnabled = isEnabled;
            localStorage.setItem('zyronZexiumAPI', isEnabled);
            showNotification(isEnabled ? 'Zexium API enabled' : 'Zexium API disabled');
            checkConnection();
        } else {
            showNotification('Failed to toggle Zexium API: ' + result.error, 'error');
            zexiumApiToggle.checked = !isEnabled;
        }
    } catch (error) {
        showNotification('Error toggling Zexium API: ' + error.message, 'error');
        zexiumApiToggle.checked = !isEnabled;
    }
}

function handleRenameUser() {
    document.getElementById('rename-modal-title').textContent = 'Change Name';
    renameModalInput.value = localStorage.getItem('zyronUsername') || '';
    renameModalOverlay.classList.remove('hidden');
    renameModalInput.focus();
}

async function confirmClearData() {
    const result = await window.electronAPI.clearAppData();
    if (result.success) {
        showNotification('App data cleared. Restarting...');
        localStorage.removeItem('zyronUsername');
        localStorage.removeItem('zyronLastActiveTab');
        localStorage.removeItem('zyronPerfMode');
        localStorage.removeItem('zyronNotifications');
        location.reload();
    } else {
        showNotification(`Failed to clear data: ${result.error}`, 'error');
    }
}
