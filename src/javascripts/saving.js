function showSaveIndicator() {
    const saveIndicatorEnabled = window.safeStorage.getItem('zyronSaveIndicator') !== 'false';
    if (!saveIndicatorEnabled) return;

    saveIndicator.classList.remove('hidden');
    saveIndicator.classList.add('flash');

    setTimeout(() => {
        saveIndicator.classList.remove('flash');
        saveIndicator.classList.add('hidden');
    }, 500);
}

function getDefaultWorkspace() {
    return {
        id: 'ws-scripts',
        name: 'scripts',
        tabOrder: []
    };
}

function normalizeLoadedWorkspaces(rawWorkspaces) {
    const workspaces = Array.isArray(rawWorkspaces) ? rawWorkspaces : [];
    if (workspaces.length === 0) {
        return [getDefaultWorkspace()];
    }

    return workspaces.map((workspace, index) => ({
        id: typeof workspace?.id === 'string' && workspace.id.trim()
            ? workspace.id.trim()
            : `workspace-${Date.now()}-${index}`,
        name: typeof workspace?.name === 'string' && workspace.name.trim()
            ? workspace.name.trim()
            : `folder ${index + 1}`,
        tabOrder: Array.isArray(workspace?.tabOrder)
            ? workspace.tabOrder.filter((tabId) => typeof tabId === 'string')
            : []
    }));
}

function normalizeLoadedTabs(rawTabs, workspaceIds) {
    const tabs = Array.isArray(rawTabs) ? rawTabs : [];
    const defaultWorkspaceId = workspaceIds[0];

    return tabs.map((tab, index) => ({
        id: typeof tab?.id === 'string' && tab.id.trim() ? tab.id : `tab-${Date.now()}-${index}`,
        name: typeof tab?.name === 'string' && tab.name.trim() ? tab.name : `Script ${index + 1}`,
        content: typeof tab?.content === 'string' ? tab.content : '',
        workspaceId: workspaceIds.includes(tab?.workspaceId) ? tab.workspaceId : defaultWorkspaceId
    }));
}

function normalizeLoadedAutoExecute(rawAutoExecute) {
    if (!rawAutoExecute || typeof rawAutoExecute !== 'object') {
        return {};
    }
    const normalized = {};
    Object.entries(rawAutoExecute).forEach(([tabId, entry]) => {
        if (!entry || typeof entry !== 'object') return;
        const enabled = Boolean(entry.enabled);
        const serial = Number(entry.serial);
        if (!Number.isFinite(serial) || serial <= 0) return;
        normalized[tabId] = {
            enabled,
            serial: Math.floor(serial)
        };
    });
    return normalized;
}

async function saveState() {
    showSaveIndicator();
    await window.electronAPI.saveState({
        tabs: TABS_DATA,
        workspaces: WORKSPACES_DATA,
        autoExecute: AUTOEXECUTE_DATA
    });
}

async function loadState() {
    const result = await window.electronAPI.loadState();
    const rawTabs = Array.isArray(result?.tabs) ? result.tabs : (Array.isArray(result?.data) ? result.data : []);
    WORKSPACES_DATA = normalizeLoadedWorkspaces(result?.workspaces);
    const workspaceIds = WORKSPACES_DATA.map((workspace) => workspace.id);
    TABS_DATA = normalizeLoadedTabs(rawTabs, workspaceIds);
    AUTOEXECUTE_DATA = normalizeLoadedAutoExecute(result?.autoExecute);
    Object.keys(AUTOEXECUTE_DATA).forEach((tabId) => {
        if (!TABS_DATA.some((tab) => tab.id === tabId)) {
            delete AUTOEXECUTE_DATA[tabId];
        }
    });

    WORKSPACES_DATA.forEach((workspace) => {
        const validIds = new Set(TABS_DATA.filter((tab) => tab.workspaceId === workspace.id).map((tab) => tab.id));
        workspace.tabOrder = workspace.tabOrder.filter((tabId) => validIds.has(tabId));
        TABS_DATA.forEach((tab) => {
            if (tab.workspaceId === workspace.id && !workspace.tabOrder.includes(tab.id)) {
                workspace.tabOrder.push(tab.id);
            }
        });
    });

    if (TABS_DATA.length === 0) {
        const defaultWorkspaceId = WORKSPACES_DATA[0].id;
        const defaultTab = {
            id: `tab-${Date.now()}`,
            name: 'Script 1',
            content: '-- Welcome to Zyron!',
            workspaceId: defaultWorkspaceId
        };
        TABS_DATA = [defaultTab];
        WORKSPACES_DATA[0].tabOrder.push(defaultTab.id);
    }

    const savedWorkspaceId = window.safeStorage.getItem('zyronActiveWorkspaceId');
    activeWorkspaceId = WORKSPACES_DATA.some((workspace) => workspace.id === savedWorkspaceId)
        ? savedWorkspaceId
        : WORKSPACES_DATA[0].id;
    window.safeStorage.setItem('zyronActiveWorkspaceId', activeWorkspaceId);

    renderWorkspaceList();
    renderAllTabs();

    const lastActiveTabId = window.safeStorage.getItem('zyronLastActiveTab');
    const lastActiveTab = TABS_DATA.find((tab) => tab.id === lastActiveTabId);
    if (lastActiveTab) {
        setActiveWorkspace(lastActiveTab.workspaceId, { persist: false });
        switchTab(lastActiveTab.id);
    } else {
        const activeWorkspaceTabs = getTabsForWorkspace(activeWorkspaceId);
        if (activeWorkspaceTabs.length > 0) {
            switchTab(activeWorkspaceTabs[0].id);
        }
    }
}

function setupAutoSave() {
    if (autoSaveInterval) clearInterval(autoSaveInterval);
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
}

function debouncedAutoSave() {
    if (!autoSaveToggle.checked) return;

    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        saveState();
        if (typeof window.syncAutoExecuteScripts === 'function') {
            window.syncAutoExecuteScripts({ notifyOnError: false });
        }
    }, 2000);
}
