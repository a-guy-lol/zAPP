function renderAllTabs() {
    // Clear existing tabs except for the new tab button
    const existingTabs = scriptTabBar.querySelectorAll('.script-tab');
    existingTabs.forEach(t => t.remove());
    TABS_DATA.forEach(tab => createTabElement(tab.id, tab.name));
}

function createTabElement(id, name) {
    const tabEl = document.createElement('div');
    tabEl.id = id;
    tabEl.className = 'script-tab';
    tabEl.draggable = true;
    tabEl.innerHTML = `<span class="tab-name">${name}</span><button class="close-btn">&times;</button>`;
    scriptTabBar.appendChild(tabEl);

    tabEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('close-btn')) return;
        switchTab(id);
    });
    tabEl.querySelector('.close-btn').addEventListener('click', e => { e.stopPropagation(); closeTab(id); });
    tabEl.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); showContextMenu(e, id); });

    // Drag and Drop listeners
    tabEl.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', id);
        setTimeout(() => tabEl.classList.add('dragging'), 0);
    });
    tabEl.addEventListener('dragend', () => tabEl.classList.remove('dragging'));
    tabEl.addEventListener('dragover', e => {
        e.preventDefault();
        const draggingEl = document.querySelector('.dragging');
        if (draggingEl !== tabEl) {
            const rect = tabEl.getBoundingClientRect();
            const nextSibling = (e.clientX - rect.left) > (rect.width / 2) ? tabEl.nextSibling : tabEl;
            scriptTabBar.insertBefore(draggingEl, nextSibling);
        }
    });
}

scriptTabBar.addEventListener('drop', e => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    const draggedEl = document.getElementById(draggedId);
    draggedEl.classList.remove('dragging');

    const newOrder = Array.from(scriptTabBar.querySelectorAll('.script-tab')).map(t => t.id);
    TABS_DATA.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
    saveState();
});

function switchTab(id) {
    if (activeTabId === id) return;

    if (activeTabId) {
        document.getElementById(activeTabId)?.classList.remove('active');
        document.getElementById(`editor-${activeTabId}`)?.classList.add('hidden');
    }
    activeTabId = id;
    window.safeStorage.setItem('zyronLastActiveTab', id);
    document.getElementById(id)?.classList.add('active');
    
    // Update Discord RPC with current script name
    const currentTab = TABS_DATA.find(t => t.id === id);
    if (currentTab) {
        window.electronAPI.updateActiveScriptName(currentTab.name);
    }
    
    let editorContainer = document.getElementById(`editor-${id}`);
    if (!editorContainer) {
        const tab = TABS_DATA.find(t => t.id === id);
        if (tab) createEditorElement(tab.id, tab.content);
        editorContainer = document.getElementById(`editor-${id}`);
    }
    if (editorContainer) {
        editorContainer.classList.remove('hidden');
        editors[id]?.resize();
        editors[id]?.focus();
    }
}

function createNewTab() {
    if (TABS_DATA.length >= MAX_TABS) {
        showNotification(`You have reached the maximum of ${MAX_TABS} tabs.`, 'error');
        return;
    }
    const newId = `tab-${Date.now()}`;
    const newName = `Script ${TABS_DATA.length + 1}`;
    TABS_DATA.push({ id: newId, name: newName, content: '' });
    createTabElement(newId, newName);
    switchTab(newId);
    saveState();
}

function closeTab(id) {
    const index = TABS_DATA.findIndex(t => t.id === id);
    if (index === -1) return;
    TABS_DATA.splice(index, 1);
    editors[id]?.destroy();
    delete editors[id];
    document.getElementById(id)?.remove();
    const editorContainer = document.getElementById(`editor-${id}`);
    if(editorContainer) editorContainer.remove();

    if (activeTabId === id) {
        const newIndex = Math.max(0, index - 1);
        const newActiveId = TABS_DATA.length > 0 ? TABS_DATA[newIndex].id : null;
        switchTab(newActiveId);
    }
    saveState();
}
