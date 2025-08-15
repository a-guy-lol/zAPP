document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initApp, 100);
});

function initApp() {
    const username = window.safeStorage.getItem('zyronUsername');
    if (username) {
        showMainApp(username);
    } else {
        showLogin();
    }
    
    const animationsEnabled = window.safeStorage.getItem('zyronAnimations') !== 'false';
    animationsToggle.checked = animationsEnabled;
    if (!animationsEnabled) document.body.classList.add('no-animations');

    const effectsEnabled = window.safeStorage.getItem('zyronEffects') !== 'false';
    effectsToggle.checked = effectsEnabled;
    if (!effectsEnabled) document.body.classList.add('no-effects');

    const saveIndicatorEnabled = window.safeStorage.getItem('zyronSaveIndicator') !== 'false';
    saveIndicatorToggle.checked = saveIndicatorEnabled;

    notificationsEnabled = window.safeStorage.getItem('zyronNotifications') !== 'false';
    notificationsToggle.checked = notificationsEnabled;

    window.electronAPI.getDiscordRpcStatus().then(isEnabled => {
        discordRpcToggle.checked = isEnabled;
    });

    const savedZexiumEnabled = window.safeStorage.getItem('zyronZexiumAPI') === 'true';
    zexiumApiToggle.checked = savedZexiumEnabled;
    isZexiumAPIEnabled = savedZexiumEnabled;

    window.electronAPI.getZexiumAPIStatus().then(status => {
        if (status.enabled !== savedZexiumEnabled) {
            isZexiumAPIEnabled = status.enabled;
            zexiumApiToggle.checked = status.enabled;
            window.safeStorage.setItem('zyronZexiumAPI', status.enabled);
        }
    });


    document.getElementById('minimize-btn').addEventListener('click', () => window.electronAPI.minimizeWindow());
    document.getElementById('close-btn').addEventListener('click', () => window.electronAPI.closeWindow());
    loginForm.addEventListener('submit', handleLogin);
    navScriptsBtn.addEventListener('click', () => switchMainView('scripts'));
    navEditorBtn.addEventListener('click', () => switchMainView('editor'));
    navSettingsBtn.addEventListener('click', () => switchMainView('settings'));
    navAboutBtn.addEventListener('click', () => switchMainView('about'));
    newTabBtn.addEventListener('click', createNewTab);
    executeBtn.addEventListener('click', executeScript);
    renameUserBtn.addEventListener('click', handleRenameUser);
    clearDataBtn.addEventListener('click', () => {
        showConfirmationModal(
            'Clear All App Data?',
            'This will delete all of your scripts and settings. This action cannot be undone.',
            confirmClearData
        );
    });
    scriptSearchBox.addEventListener('input', filterTabs);
    
    const scriptHubSearch = document.getElementById('script-hub-search');
    if (scriptHubSearch) {
        scriptHubSearch.addEventListener('input', filterScriptCards);
    }
    
    contextMenu.addEventListener('click', handleContextMenuClick);
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.classList.add('hidden');
        }
    });
    
    renameModalCancelBtn.addEventListener('click', () => renameModalOverlay.classList.add('hidden'));
    renameModalSaveBtn.addEventListener('click', saveTabRename);
    renameModalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveTabRename();
        if (e.key === 'Escape') renameModalOverlay.classList.add('hidden');
    });

    autoSaveToggle.addEventListener('change', setupAutoSave);
    animationsToggle.addEventListener('change', toggleAnimations);
    effectsToggle.addEventListener('change', toggleEffects);
    saveIndicatorToggle.addEventListener('change', toggleSaveIndicator);
    notificationsToggle.addEventListener('change', toggleNotifications);
    discordRpcToggle.addEventListener('change', toggleDiscordRpc);
    zexiumApiToggle.addEventListener('change', toggleZexiumAPI);

    initializeSettingsTabs();

    setupStatusPopups();

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelector('.filter-btn.active').classList.remove('active');
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            filterScriptCards();
        });
    });

    setupScriptSettingsModal();

    window.electronAPI.onRequestFinalSave(async () => {
        await saveState();
        window.electronAPI.notifyFinalSaveComplete();
    });

    setupUpdateModal();
}

function showLogin() {
    loginView.classList.remove('hidden');
    mainAppView.classList.add('hidden');
}

async function showMainApp(username) {
    loginView.classList.add('hidden');
    mainAppView.classList.remove('hidden');
    userDisplay.textContent = `Welcome, ${username}`;
    
    await loadState();
    await loadChangelog();
    loadScriptCards();
    checkConnection();
    if (connectionCheckInterval) clearInterval(connectionCheckInterval);
    connectionCheckInterval = setInterval(checkConnection, 3000);
    setupAutoSave();
}

    async function handleLogin(event) {
        event.preventDefault();
        const username = usernameInput.value.trim();
        if (username) {
            window.safeStorage.setItem('zyronUsername', username);
            showMainApp(username);
        }
    }