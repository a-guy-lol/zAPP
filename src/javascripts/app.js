const PROFILE_AVATAR_PRESETS = [
    {
        id: 'dark-white',
        label: 'Dark White',
        palette: ['#12151b', '#2f3542', '#6b7280', '#dde3ec']
    },
    {
        id: 'dark-gold',
        label: 'Dark Gold',
        palette: ['#1a1408', '#473410', '#8c6120', '#e0b557']
    },
    {
        id: 'dark-red',
        label: 'Dark Red',
        palette: ['#1a0a0d', '#4b1820', '#8e3041', '#d45d74']
    },
    {
        id: 'dark-green',
        label: 'Dark Green',
        palette: ['#0d1611', '#1b4a31', '#2f7a54', '#65ce98']
    },
    {
        id: 'light-white',
        label: 'Light White',
        palette: ['#f8f9fb', '#e2e7ee', '#b8c1ce', '#727b89']
    },
    {
        id: 'light-gold',
        label: 'Light Gold',
        palette: ['#fff6da', '#f4dc96', '#ddb354', '#9a6e1e']
    },
    {
        id: 'light-red',
        label: 'Light Red',
        palette: ['#ffe9ee', '#f7b2be', '#dc758b', '#9f3950']
    },
    {
        id: 'light-green',
        label: 'Light Green',
        palette: ['#e9fff2', '#ace8c8', '#67bf8d', '#2f8659']
    }
];

const DEFAULT_AVATAR_ID = PROFILE_AVATAR_PRESETS[0].id;
const MAX_NOTIFICATION_HISTORY = 80;
const MAX_NOTIFICATION_AGE_MS = 1000 * 60 * 60 * 24 * 14;
const AUTOEXECUTE_MODAL_RENDER_LIMIT = 500;

let selectedAvatarId = DEFAULT_AVATAR_ID;
let notificationHistory = [];
let sideProfileEditing = false;
let autoexecuteCollapsedFolders = {};
let appBuildVersion = null;
let latestChangelogVersion = null;
let isDevelopmentBuild = false;
let appDataFileSizeBytes = 0;

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initApp, 100);
});

async function initApp() {
    if (window.safeStorageReady && typeof window.safeStorageReady.then === 'function') {
        try {
            await window.safeStorageReady;
        } catch (error) {
            console.error('Preference store initialization failed:', error);
        }
    }

    await refreshSettingsSidePanelInfo();
    updateConsoleSidePanelInfo();

    let username = null;
    try {
        const usernameResult = await window.electronAPI.loadUsername();
        if (usernameResult && usernameResult.success) {
            username = usernameResult.username;
        }
    } catch (error) {
        console.error('Failed to load username:', error);
    }

    selectedAvatarId = getStoredAvatarId();
    notificationHistory = loadNotificationHistory();
    autoexecuteCollapsedFolders = loadAutoexecuteFolderCollapseState();

    const animationsEnabled = window.safeStorage.getItem('zyronAnimations') !== 'false';
    animationsToggle.checked = animationsEnabled;
    if (!animationsEnabled) document.body.classList.add('no-animations');

    const navMotionEnabled = window.safeStorage.getItem('zyronNavMotion') !== 'false';
    navMotionToggle.checked = navMotionEnabled;
    if (!navMotionEnabled) document.body.classList.add('no-nav-motion');
    navSpeedSlider.disabled = !navMotionEnabled;

    const navSpeedValue = Number(window.safeStorage.getItem('zyronNavSpeed')) || 2;
    navSpeedSlider.value = String(Math.min(3, Math.max(1, navSpeedValue)));
    applyNavSpeed(navSpeedSlider.value);

    const effectsEnabled = window.safeStorage.getItem('zyronEffects') !== 'false';
    effectsToggle.checked = effectsEnabled;
    if (!effectsEnabled) document.body.classList.add('no-effects');

    const saveIndicatorEnabled = window.safeStorage.getItem('zyronSaveIndicator') !== 'false';
    saveIndicatorToggle.checked = saveIndicatorEnabled;

    notificationsEnabled = window.safeStorage.getItem('zyronNotifications') !== 'false';
    notificationsToggle.checked = notificationsEnabled;
    const consoleLoggingEnabled = window.safeStorage.getItem('zyronRbxConsoleLogging') === 'true';
    rbxConsoleLoggingToggle.checked = consoleLoggingEnabled;

    const storedDiscordRpc = window.safeStorage.getItem('zyronDiscordRpc');
    if (storedDiscordRpc === null) {
        try {
            const isEnabled = await window.electronAPI.getDiscordRpcStatus();
            discordRpcToggle.checked = isEnabled;
            window.safeStorage.setItem('zyronDiscordRpc', isEnabled);
        } catch (error) {
            discordRpcToggle.checked = true;
        }
    } else {
        const isEnabled = storedDiscordRpc !== 'false';
        discordRpcToggle.checked = isEnabled;
        try {
            await window.electronAPI.toggleDiscordRpc(isEnabled);
        } catch (error) {
            console.error('Failed to sync Discord RPC preference:', error);
        }
    }

    const storedExecutorRaw = window.safeStorage.getItem('zyronExecutor');
    let initialExecutor = normalizeExecutor(storedExecutorRaw);
    try {
        const backendExecutor = normalizeExecutor(await window.electronAPI.getSelectedExecutor());
        if (!storedExecutorRaw) {
            initialExecutor = backendExecutor;
        }
    } catch (error) {
        console.error('Failed to read selected executor from backend:', error);
    }
    await setSelectedExecutor(initialExecutor, { persist: false, notify: false });

    renderOnboardingAvatarChoices();
    renderAvatarPickerChoices();

    updateSideProfile(username || 'Zyron User');
    renderNotificationHistory();
    updateUnreadNotificationBadge();

    if (username) {
        await showMainApp(username);
    } else {
        showLogin();
    }

    document.getElementById('minimize-btn').addEventListener('click', () => window.electronAPI.minimizeWindow());
    document.getElementById('close-btn').addEventListener('click', () => window.electronAPI.closeWindow());
    loginForm.addEventListener('submit', handleLogin);
    navScriptsBtn.addEventListener('click', () => switchMainView('scripts'));
    navEditorBtn.addEventListener('click', () => switchMainView('editor'));
    navConsoleBtn.addEventListener('click', () => switchMainView('console'));
    navSettingsBtn.addEventListener('click', () => switchMainView('settings'));
    navAboutBtn.addEventListener('click', () => switchMainView('about'));
    newTabBtn.addEventListener('click', createNewTab);
    autoexecuteManagerBtn.addEventListener('click', openAutoexecuteModal);
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
        if (!sideNotificationsPopup.classList.contains('hidden')) {
            const clickedInsidePopup = sideNotificationsPopup.contains(e.target);
            const clickedTrigger = sideNotificationsBtn.contains(e.target);
            if (!clickedInsidePopup && !clickedTrigger) {
                closeNotificationPopup();
            }
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
    navMotionToggle.addEventListener('change', toggleNavMotion);
    navSpeedSlider.addEventListener('input', updateNavSpeed);
    navSpeedSlider.addEventListener('change', updateNavSpeed);
    effectsToggle.addEventListener('change', toggleEffects);
    saveIndicatorToggle.addEventListener('change', toggleSaveIndicator);
    notificationsToggle.addEventListener('change', toggleNotifications);
    rbxConsoleLoggingToggle.addEventListener('change', toggleRobloxConsoleLogging);
    discordRpcToggle.addEventListener('change', toggleDiscordRpc);

    sideProfileName.addEventListener('click', startSideProfileRename);
    sideProfileAvatar.addEventListener('click', openAvatarPicker);
    sideProfileNameInput.addEventListener('keydown', handleProfileNameInputKeydown);
    sideProfileNameInput.addEventListener('blur', commitSideProfileRename);
    avatarPickerClose.addEventListener('click', closeAvatarPicker);
    avatarPickerOverlay.addEventListener('click', (event) => {
        if (event.target === avatarPickerOverlay) {
            closeAvatarPicker();
        }
    });
    autoexecuteModalClose.addEventListener('click', closeAutoexecuteModal);
    autoexecuteModalOverlay.addEventListener('click', (event) => {
        if (event.target === autoexecuteModalOverlay) {
            closeAutoexecuteModal();
        }
    });
    window.addEventListener('resize', () => {
        if (!sideNotificationsPopup.classList.contains('hidden')) {
            positionNotificationPopup();
        }
    });

    initializeSettingsTabs();
    setupExecutorSelector();
    initializeWorkspacePanel();
    setupSidePanel();
    setupStatusPopups();

    document.querySelectorAll('.script-filter-buttons .filter-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const current = document.querySelector('.script-filter-buttons .filter-btn.active');
            if (current) current.classList.remove('active');
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            filterScriptCards();
        });
    });

    setupScriptSettingsModal();

    window.electronAPI.onRequestFinalSave(async () => {
        try {
            await saveState();
            window.safeStorage.setItem('zyronExecutor', selectedExecutor);
            if (typeof window.safeStorageFlush === 'function') {
                await window.safeStorageFlush();
            }
            await window.electronAPI.setSelectedExecutor(selectedExecutor);
            await syncAutoExecuteScripts({ notifyOnError: false });
        } catch (error) {
            console.error('Final save failed:', error);
        } finally {
            window.electronAPI.notifyFinalSaveComplete();
        }
    });

    setupUpdateModal();
}

function normalizeVersion(version) {
    if (!version) return '';
    return String(version).replace(/^v/i, '').trim();
}

function compareVersions(versionA, versionB) {
    const a = normalizeVersion(versionA).split('.').map((value) => Number(value) || 0);
    const b = normalizeVersion(versionB).split('.').map((value) => Number(value) || 0);
    const length = Math.max(a.length, b.length);
    for (let i = 0; i < length; i += 1) {
        const diff = (a[i] || 0) - (b[i] || 0);
        if (diff !== 0) return diff > 0 ? 1 : -1;
    }
    return 0;
}

function getExecutorLabel(executor = selectedExecutor) {
    return executor === 'macsploit' ? 'MacSploit' : 'Hydrogen';
}

function formatDataSize(bytesValue) {
    const bytes = Math.max(0, Number(bytesValue) || 0);
    if (bytes < 1000) {
        return `${bytes} b`;
    }
    if (bytes < 1000000) {
        return `${(bytes / 1000).toFixed(2)} kb`;
    }
    return `${(bytes / 1000000).toFixed(2)} mb`;
}

function getBuildLatestStatus(buildVersion, latestVersion) {
    if (!buildVersion || !latestVersion) {
        return 'Checking';
    }
    const versionDiff = compareVersions(buildVersion, latestVersion);
    return versionDiff < 0 ? 'Outdated' : 'Up to date';
}

function updateConsoleSidePanelInfo() {
    if (!consoleSideLoggingStatus || !consoleSideTotalLogs || !consoleSideErrorLogs || !consoleSideWarnLogs) {
        return;
    }

    const metrics = typeof window.getConsoleMetrics === 'function'
        ? window.getConsoleMetrics()
        : { active: false, totalLogs: 0, errorLogs: 0, warnLogs: 0 };

    consoleSideLoggingStatus.textContent = metrics.active ? 'On' : 'Off';
    consoleSideTotalLogs.textContent = String(metrics.totalLogs || 0);
    consoleSideErrorLogs.textContent = String(metrics.errorLogs || 0);
    consoleSideWarnLogs.textContent = String(metrics.warnLogs || 0);
    if (consoleSideExecutor) {
        consoleSideExecutor.textContent = getExecutorLabel();
    }
}

function updateSettingsSidePanelInfo() {
    if (!settingsSideBuildVersion || !settingsSideLatestVersion || !settingsSideDataSize) {
        return;
    }

    const buildVersion = normalizeVersion(appBuildVersion);
    const latestVersion = normalizeVersion(latestChangelogVersion || window.latestChangelogVersion);
    const latestStatus = getBuildLatestStatus(buildVersion, latestVersion);

    settingsSideBuildVersion.textContent = buildVersion
        ? `${buildVersion}${isDevelopmentBuild ? ' Dev' : ''}`
        : '-';
    settingsSideDataSize.textContent = formatDataSize(appDataFileSizeBytes);
    if (settingsSideExecutor) {
        settingsSideExecutor.textContent = getExecutorLabel();
    }

    settingsSideLatestVersion.textContent = latestStatus;
}

function updateAboutSidePanelInfo() {
    if (!aboutSideBuildVersion || !aboutSideLatestStatus) {
        return;
    }

    const buildVersion = normalizeVersion(appBuildVersion);
    const latestVersion = normalizeVersion(latestChangelogVersion || window.latestChangelogVersion);
    const latestStatus = getBuildLatestStatus(buildVersion, latestVersion);

    aboutSideBuildVersion.textContent = buildVersion
        ? `${buildVersion}${isDevelopmentBuild ? ' Dev' : ''}`
        : '-';
    aboutSideLatestStatus.textContent = latestStatus;
}

async function refreshSettingsSidePanelInfo() {
    try {
        if (!appBuildVersion && window.electronAPI?.getAppVersion) {
            appBuildVersion = await window.electronAPI.getAppVersion();
        }
        if (window.electronAPI?.isDevelopment) {
            isDevelopmentBuild = Boolean(await window.electronAPI.isDevelopment());
        }
        if (window.electronAPI?.getAppDataFileSize) {
            const sizeResult = await window.electronAPI.getAppDataFileSize();
            if (sizeResult?.success) {
                appDataFileSizeBytes = Number(sizeResult.bytes) || 0;
            }
        }
    } catch (error) {
        console.error('Failed to read app version for settings side panel:', error);
    }

    latestChangelogVersion = normalizeVersion(window.latestChangelogVersion || latestChangelogVersion);
    updateSettingsSidePanelInfo();
    updateAboutSidePanelInfo();
}

window.updateConsoleSidePanelInfo = updateConsoleSidePanelInfo;
window.updateSettingsSidePanelInfo = updateSettingsSidePanelInfo;
window.updateAboutSidePanelInfo = updateAboutSidePanelInfo;
window.refreshSettingsSidePanelInfo = refreshSettingsSidePanelInfo;

function getAvatarPreset(avatarId) {
    return PROFILE_AVATAR_PRESETS.find((preset) => preset.id === avatarId) || PROFILE_AVATAR_PRESETS[0];
}

function buildAvatarBackground(presetId) {
    const preset = getAvatarPreset(presetId);
    const [c0, c1, c2, c3] = preset.palette;

    return `
        radial-gradient(128% 118% at 28% 22%, ${c3}c7 0%, transparent 54%),
        radial-gradient(108% 102% at 72% 80%, ${c1}73 0%, transparent 64%),
        linear-gradient(145deg, ${c0} 0%, ${c1} 38%, ${c2} 72%, ${c3} 100%)
    `;
}

function getStoredAvatarId() {
    const storedAvatar = window.safeStorage.getItem('zyronProfileAvatarId');
    if (!storedAvatar) return DEFAULT_AVATAR_ID;
    return getAvatarPreset(storedAvatar).id;
}

function applySelectedAvatar(avatarId, { persist = true } = {}) {
    selectedAvatarId = getAvatarPreset(avatarId).id;
    updateSideProfile(window.safeStorage.getItem('zyronUsername') || sideProfileName.textContent);
    renderOnboardingAvatarChoices();
    renderAvatarPickerChoices();
    if (persist) {
        window.safeStorage.setItem('zyronProfileAvatarId', selectedAvatarId);
    }
}

function renderOnboardingAvatarChoices() {
    renderAvatarChoices(onboardingAvatarGrid, {
        selectedId: selectedAvatarId,
        onSelect: (pickedId) => {
            selectedAvatarId = pickedId;
            renderOnboardingAvatarChoices();
        }
    });
}

function renderAvatarPickerChoices() {
    renderAvatarChoices(avatarPickerGrid, {
        selectedId: selectedAvatarId,
        compact: true,
        onSelect: (pickedId) => {
            applySelectedAvatar(pickedId, { persist: true });
            closeAvatarPicker();
        }
    });
}

function renderAvatarChoices(container, { selectedId, onSelect, compact = false } = {}) {
    if (!container) return;
    container.innerHTML = '';

    PROFILE_AVATAR_PRESETS.forEach((preset) => {
        const choice = document.createElement('button');
        choice.type = 'button';
        choice.className = `avatar-choice${compact ? ' compact' : ''}`;
        choice.dataset.avatarId = preset.id;
        choice.classList.toggle('selected', preset.id === selectedId);
        choice.title = preset.label;

        const preview = document.createElement('span');
        preview.className = 'avatar-choice-preview';
        preview.style.background = buildAvatarBackground(preset.id);

        const label = document.createElement('span');
        label.className = 'avatar-choice-label';
        label.textContent = preset.label;

        choice.appendChild(preview);
        if (!compact) {
            choice.appendChild(label);
        }

        choice.addEventListener('click', () => {
            if (typeof onSelect === 'function') {
                onSelect(preset.id);
            }
        });

        container.appendChild(choice);
    });
}

function openAvatarPicker() {
    if (loginView && !loginView.classList.contains('hidden')) return;
    avatarPickerOverlay.classList.remove('hidden');
    renderAvatarPickerChoices();
}

function closeAvatarPicker() {
    avatarPickerOverlay.classList.add('hidden');
}

function showLogin() {
    loginView.classList.remove('hidden');
    mainAppView.classList.add('hidden');
    usernameInput.value = '';
    usernameInput.focus();
}

async function showMainApp(username) {
    loginView.classList.add('hidden');
    mainAppView.classList.remove('hidden');
    updateSideProfile(username);

    await loadState();
    await syncAutoExecuteScripts({ notifyOnError: false });
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
    if (!username) return;

    applySelectedAvatar(selectedAvatarId, { persist: true });
    await persistUsername(username);
    await showMainApp(username);
}

async function persistUsername(username) {
    const cleanName = String(username || '').trim();
    if (!cleanName) return;

    window.safeStorage.setItem('zyronUsername', cleanName);
    updateSideProfile(cleanName);
    try {
        await window.electronAPI.saveUsername(cleanName);
    } catch (error) {
        console.error('Failed to save username:', error);
    }
}

window.persistUsername = persistUsername;

function normalizeExecutor(executor) {
    return executor === 'macsploit' ? 'macsploit' : 'hydrogen';
}

function updateExecutorSelectorUI() {
    const iconByExecutor = {
        hydrogen: 'assets/images/Hydrogen.png',
        macsploit: 'assets/images/MacSploit.png'
    };
    const labelByExecutor = {
        hydrogen: 'Hydrogen',
        macsploit: 'MacSploit'
    };

    executorSelectedIcon.src = iconByExecutor[selectedExecutor];
    executorSelectedIcon.alt = labelByExecutor[selectedExecutor];
    executorSelectedLabel.textContent = labelByExecutor[selectedExecutor];

    executorOptions.forEach((option) => {
        option.classList.toggle('active', option.dataset.executor === selectedExecutor);
    });
}

async function setSelectedExecutor(executor, { persist = true, notify = false } = {}) {
    const normalizedExecutor = normalizeExecutor(executor);
    selectedExecutor = normalizedExecutor;
    updateExecutorSelectorUI();

    try {
        await window.electronAPI.setSelectedExecutor(normalizedExecutor);
    } catch (error) {
        console.error('Failed to set selected executor:', error);
    }

    if (persist) {
        window.safeStorage.setItem('zyronExecutor', normalizedExecutor);
    }

    if (notify) {
        const label = normalizedExecutor === 'macsploit' ? 'MacSploit' : 'Hydrogen';
        showNotification(`Executor switched to ${label}`, 'info');
    }

    updateConsoleSidePanelInfo();
    updateSettingsSidePanelInfo();

    if (typeof window.syncConsoleBridgeState === 'function') {
        await window.syncConsoleBridgeState({ notifyOnError: notify });
    }
    await syncAutoExecuteScripts({ notifyOnError: notify });

    checkConnection();
}

function setupExecutorSelector() {
    executorSelectorBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const willOpen = executorSelectorMenu.classList.contains('hidden');
        executorSelectorMenu.classList.toggle('hidden', !willOpen);
        executorSelectorBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });

    executorOptions.forEach((option) => {
        option.addEventListener('click', async (event) => {
            event.stopPropagation();
            executorSelectorMenu.classList.add('hidden');
            executorSelectorBtn.setAttribute('aria-expanded', 'false');
            await setSelectedExecutor(option.dataset.executor, { persist: true, notify: true });
        });
    });

    document.addEventListener('click', (event) => {
        if (!executorSelector.contains(event.target)) {
            executorSelectorMenu.classList.add('hidden');
            executorSelectorBtn.setAttribute('aria-expanded', 'false');
        }
    });
}

function updateSideProfile(name) {
    const displayName = String(name || 'Zyron User').trim() || 'Zyron User';
    sideProfileName.textContent = displayName;

    const avatarPreset = getAvatarPreset(selectedAvatarId);
    sideProfileAvatar.textContent = '';
    sideProfileAvatar.style.background = buildAvatarBackground(avatarPreset.id);
}

function startSideProfileRename() {
    if (sideProfileEditing) return;
    sideProfileEditing = true;

    sideProfileNameInput.value = sideProfileName.textContent.trim();
    sideProfileName.classList.add('hidden');
    sideProfileNameInput.classList.remove('hidden');
    sideProfileNameInput.focus();
    sideProfileNameInput.select();
}

function cancelSideProfileRename() {
    sideProfileEditing = false;
    sideProfileNameInput.classList.add('hidden');
    sideProfileName.classList.remove('hidden');
}

async function commitSideProfileRename() {
    if (!sideProfileEditing) return;
    const proposedName = sideProfileNameInput.value.trim();
    if (!proposedName) {
        cancelSideProfileRename();
        return;
    }
    await persistUsername(proposedName);
    cancelSideProfileRename();
}

function handleProfileNameInputKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        commitSideProfileRename();
    } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelSideProfileRename();
    }
}

function loadNotificationHistory() {
    const raw = window.safeStorage.getItem('zyronNotificationHistory');
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const normalized = parsed
            .filter((entry) => entry && typeof entry === 'object')
            .slice(-MAX_NOTIFICATION_HISTORY)
            .map((entry, index) => ({
                id: String(entry.id || `${Date.now()}-${index}`),
                type: entry.type === 'error' ? 'error' : 'info',
                title: String(entry.title || (entry.type === 'error' ? 'Error' : 'Notice')),
                message: String(entry.message || ''),
                read: Boolean(entry.read),
                createdAt: String(entry.createdAt || new Date().toISOString())
            }));
        return pruneNotificationHistory(normalized);
    } catch (error) {
        console.error('Failed to parse notification history:', error);
        return [];
    }
}

function pruneNotificationHistory(entries) {
    const now = Date.now();
    return entries
        .filter((entry) => {
            if (!entry || typeof entry !== 'object') return false;
            const parsedTime = Date.parse(entry.createdAt);
            if (!Number.isFinite(parsedTime)) return true;
            return now - parsedTime <= MAX_NOTIFICATION_AGE_MS;
        })
        .slice(-MAX_NOTIFICATION_HISTORY);
}

function loadAutoexecuteFolderCollapseState() {
    const raw = window.safeStorage.getItem('zyronAutoExecuteFolderCollapse');
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {};
        }
        return parsed;
    } catch (error) {
        return {};
    }
}

function persistAutoexecuteFolderCollapseState() {
    window.safeStorage.setItem(
        'zyronAutoExecuteFolderCollapse',
        JSON.stringify(autoexecuteCollapsedFolders || {})
    );
}

function persistNotificationHistory() {
    notificationHistory = pruneNotificationHistory(notificationHistory);
    window.safeStorage.setItem('zyronNotificationHistory', JSON.stringify(notificationHistory));
}

function updateUnreadNotificationBadge() {
    const unreadCount = notificationHistory.filter((entry) => !entry.read).length;
    if (unreadCount > 0) {
        sideNotificationBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        sideNotificationBadge.classList.remove('hidden');
    } else {
        sideNotificationBadge.classList.add('hidden');
    }
}

function renderNotificationHistory() {
    if (!sideNotificationsList) return;
    sideNotificationsList.innerHTML = '';

    if (notificationHistory.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'side-notification-empty';
        empty.textContent = 'No notifications yet.';
        sideNotificationsList.appendChild(empty);
        return;
    }

    notificationHistory
        .slice()
        .reverse()
        .forEach((entry) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = `side-notification-item ${entry.type}${entry.read ? '' : ' unread'}`;

            const icon = document.createElement('img');
            icon.className = 'side-notification-item-icon';
            icon.src = 'assets/images/notification.png';
            icon.alt = '';

            const body = document.createElement('div');
            body.className = 'side-notification-item-body';

            const title = document.createElement('div');
            title.className = 'side-notification-item-title';
            title.textContent = entry.title;

            const message = document.createElement('div');
            message.className = 'side-notification-item-message';
            message.textContent = entry.message;

            const time = document.createElement('div');
            time.className = 'side-notification-item-time';
            time.textContent = new Date(entry.createdAt).toLocaleString();

            body.appendChild(title);
            body.appendChild(message);
            body.appendChild(time);

            item.appendChild(icon);
            item.appendChild(body);

            item.addEventListener('click', () => {
                entry.read = true;
                persistNotificationHistory();
                renderNotificationHistory();
                updateUnreadNotificationBadge();
            });

            sideNotificationsList.appendChild(item);
        });
}

function markAllNotificationsRead() {
    let changed = false;
    notificationHistory.forEach((entry) => {
        if (!entry.read) {
            changed = true;
            entry.read = true;
        }
    });
    if (changed) {
        persistNotificationHistory();
    }
    updateUnreadNotificationBadge();
    renderNotificationHistory();
}

function markNotificationReadById(notificationId) {
    if (!notificationId) return;
    const target = notificationHistory.find((entry) => entry.id === notificationId);
    if (!target || target.read) return;
    target.read = true;
    persistNotificationHistory();
    renderNotificationHistory();
    updateUnreadNotificationBadge();
}

function openNotificationPopup() {
    positionNotificationPopup();
    sideNotificationsPopup.classList.remove('hidden');
    renderNotificationHistory();
    markAllNotificationsRead();
}

function closeNotificationPopup() {
    sideNotificationsPopup.classList.add('hidden');
}

function toggleNotificationPopup() {
    const shouldOpen = sideNotificationsPopup.classList.contains('hidden');
    if (shouldOpen) {
        openNotificationPopup();
    } else {
        closeNotificationPopup();
    }
}

function positionNotificationPopup() {
    if (!sideNotificationsBtn || !sideNotificationsPopup) return;
    const buttonRect = sideNotificationsBtn.getBoundingClientRect();
    const popupWidth = 320;
    const margin = 8;
    const viewportPadding = 12;

    let left = buttonRect.right + margin;
    if (left + popupWidth > window.innerWidth - viewportPadding) {
        left = Math.max(viewportPadding, buttonRect.left - popupWidth - margin);
    }

    const top = Math.max(68, Math.min(window.innerHeight - 420, buttonRect.top - 6));
    sideNotificationsPopup.style.left = `${Math.round(left)}px`;
    sideNotificationsPopup.style.top = `${Math.round(top)}px`;
}

function generateScriptSerial() {
    let serial = Math.floor(10000 + Math.random() * 900000);
    const usedSerials = new Set(
        Object.values(AUTOEXECUTE_DATA || {})
            .map((entry) => Number(entry?.serial))
            .filter((value) => Number.isFinite(value))
    );
    while (usedSerials.has(serial)) {
        serial = Math.floor(10000 + Math.random() * 900000);
    }
    return serial;
}

function getAutoExecuteEntry(tabId) {
    if (!AUTOEXECUTE_DATA[tabId]) {
        AUTOEXECUTE_DATA[tabId] = {
            enabled: false,
            serial: generateScriptSerial()
        };
    }
    return AUTOEXECUTE_DATA[tabId];
}

function collectAutoExecutePayloadScripts() {
    return TABS_DATA.map((tab) => {
        const entry = getAutoExecuteEntry(tab.id);
        return {
            id: tab.id,
            serial: entry.serial,
            enabled: Boolean(entry.enabled),
            content: tab.content || ''
        };
    });
}

async function syncAutoExecuteScripts({ notifyOnError = true } = {}) {
    if (!window.electronAPI || typeof window.electronAPI.syncAutoexecuteScripts !== 'function') {
        return { success: false, error: 'Autoexecute bridge unavailable.' };
    }

    const payload = {
        executor: selectedExecutor,
        scripts: collectAutoExecutePayloadScripts()
    };

    try {
        const editorResult = await window.electronAPI.syncAutoexecuteScripts(payload);
        const supportsScriptHubSync = typeof window.electronAPI.syncScriptHubAutoexecute === 'function';
        const scriptHubResult = supportsScriptHubSync
            ? await window.electronAPI.syncScriptHubAutoexecute({ executor: selectedExecutor })
            : { success: true };

        const failed = !editorResult.success ? editorResult : (!scriptHubResult.success ? scriptHubResult : null);
        if (failed && notifyOnError) {
            showNotification(failed.error || 'Failed to sync autoexecute scripts.', 'error');
        }

        return {
            success: !failed,
            editorResult,
            scriptHubResult
        };
    } catch (error) {
        if (notifyOnError) {
            showNotification(`Autoexecute sync failed: ${error.message}`, 'error');
        }
        return { success: false, error: error.message };
    }
}

function renderAutoexecuteDirectory() {
    if (!autoexecuteDirectoryList) return;
    autoexecuteDirectoryList.innerHTML = '';

    if (!WORKSPACES_DATA.length) {
        autoexecuteDirectoryList.innerHTML = '<div class="autoexecute-empty">No folders yet.</div>';
        return;
    }

    const tree = document.createElement('div');
    tree.className = 'autoexecute-tree';

    let renderedCount = 0;
    WORKSPACES_DATA.forEach((workspace) => {
        if (renderedCount > AUTOEXECUTE_MODAL_RENDER_LIMIT) return;
        const tabs = getTabsForWorkspace(workspace.id);
        const collapsed = Boolean(autoexecuteCollapsedFolders[workspace.id]);
        const folderRow = document.createElement('button');
        folderRow.type = 'button';
        folderRow.className = `autoexec-row folder${collapsed ? ' collapsed' : ''}`;
        folderRow.innerHTML = `
            <span class="autoexec-caret" aria-hidden="true"></span>
            <img src="assets/images/folder.png" alt="" class="autoexec-icon">
            <span class="autoexec-name">${workspace.name}</span>
        `;
        folderRow.addEventListener('click', () => {
            autoexecuteCollapsedFolders[workspace.id] = !Boolean(autoexecuteCollapsedFolders[workspace.id]);
            persistAutoexecuteFolderCollapseState();
            renderAutoexecuteDirectory();
        });
        tree.appendChild(folderRow);

        if (collapsed) {
            return;
        }

        if (tabs.length === 0) {
            const emptyRow = document.createElement('div');
            emptyRow.className = 'autoexec-row empty';
            emptyRow.innerHTML = `<span class="autoexecute-empty">No scripts in this folder.</span>`;
            tree.appendChild(emptyRow);
            return;
        }

        tabs.forEach((tab) => {
            if (renderedCount > AUTOEXECUTE_MODAL_RENDER_LIMIT) return;
            renderedCount += 1;

            const entry = getAutoExecuteEntry(tab.id);
            const scriptRow = document.createElement('button');
            scriptRow.type = 'button';
            scriptRow.className = `autoexec-row script${entry.enabled ? ' enabled' : ''}`;
            scriptRow.innerHTML = `
                <img src="assets/images/script.png" alt="" class="autoexec-icon">
                <span class="autoexec-name">${tab.name}</span>
                <span class="autoexec-state${entry.enabled ? ' enabled' : ''}">
                    <img src="assets/images/autoexecute.png" alt="" class="autoexec-state-icon">
                    <span>${entry.enabled ? 'On' : 'Off'}</span>
                </span>
            `;

            scriptRow.addEventListener('click', async () => {
                entry.enabled = !entry.enabled;
                renderAutoexecuteDirectory();
                await saveState();
                await syncAutoExecuteScripts({ notifyOnError: true });
            });

            tree.appendChild(scriptRow);
        });
    });

    autoexecuteDirectoryList.appendChild(tree);
}

function openAutoexecuteModal() {
    renderAutoexecuteDirectory();
    autoexecuteModalOverlay.classList.remove('hidden');
}

function closeAutoexecuteModal() {
    autoexecuteModalOverlay.classList.add('hidden');
}

function setupSidePanel() {
    const applySidePanelState = (collapsed) => {
        leftSidePanel.classList.toggle('collapsed', collapsed);
        leftSidePanel.classList.toggle('expanded', !collapsed);
        sidePanelToggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        sidePanelToggleBtn.setAttribute('aria-label', collapsed ? 'Expand side panel' : 'Collapse side panel');
        sidePanelToggleBtn.title = collapsed ? 'Expand side panel' : 'Collapse side panel';
    };

    const savedCollapsed = window.safeStorage.getItem('zyronSidePanelCollapsed') === 'true';
    applySidePanelState(savedCollapsed);

    sidePanelToggleBtn.addEventListener('click', () => {
        const collapsed = !leftSidePanel.classList.contains('collapsed');
        applySidePanelState(collapsed);
        window.safeStorage.setItem('zyronSidePanelCollapsed', collapsed);
        if (collapsed) closeNotificationPopup();
    });

    sideNotificationsBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (leftSidePanel.classList.contains('collapsed')) return;
        toggleNotificationPopup();
    });

    sideNotificationsCloseBtn.addEventListener('click', () => {
        closeNotificationPopup();
    });

    renderNotificationHistory();
    updateUnreadNotificationBadge();
}

window.onMainViewChanged = function onMainViewChanged(viewName) {
    sidePanelSlots.forEach((slot) => {
        slot.classList.toggle('active', slot.dataset.view === viewName);
    });
    updateConsoleSidePanelInfo();
    if (viewName === 'settings') {
        refreshSettingsSidePanelInfo();
    } else if (viewName === 'about') {
        refreshSettingsSidePanelInfo();
    } else {
        updateSettingsSidePanelInfo();
        updateAboutSidePanelInfo();
    }
    closeNotificationPopup();
};

window.recordNotification = function recordNotification({ message, type = 'info', title = 'Notice' }) {
    const normalizedType = type === 'error' ? 'error' : 'info';
    const normalizedTitle = String(title || (normalizedType === 'error' ? 'Error' : 'Notice')).trim()
        || (normalizedType === 'error' ? 'Error' : 'Notice');
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage) return;

    const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: normalizedType,
        title: normalizedTitle,
        message: normalizedMessage,
        read: false,
        createdAt: new Date().toISOString()
    };
    notificationHistory.push(entry);

    notificationHistory = pruneNotificationHistory(notificationHistory);

    persistNotificationHistory();
    renderNotificationHistory();
    updateUnreadNotificationBadge();
    return entry.id;
};

window.markNotificationReadById = markNotificationReadById;

window.incrementUnreadNotifications = function incrementUnreadNotifications() {
    updateUnreadNotificationBadge();
};

window.clearUnreadNotifications = function clearUnreadNotifications() {
    markAllNotificationsRead();
};

window.syncAutoExecuteScripts = syncAutoExecuteScripts;
window.updateSideProfile = updateSideProfile;
