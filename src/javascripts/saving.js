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

async function saveState() {
    showSaveIndicator();
    if (TABS_DATA) {
        await window.electronAPI.saveState(TABS_DATA);
    }
}

async function loadState() {
    const result = await window.electronAPI.loadState();
    if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
        TABS_DATA = result.data;
    } else {
        TABS_DATA = [{ id: `tab-${Date.now()}`, name: 'Script 1', content: '-- Welcome to Zyron!' }];
    }
    renderAllTabs();
    if (TABS_DATA.length > 0) {
         const lastActiveTab = TABS_DATA.find(t => t.id === window.safeStorage.getItem('zyronLastActiveTab'));
         switchTab(lastActiveTab ? lastActiveTab.id : TABS_DATA[0].id);
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
    }, 2000); 
}
