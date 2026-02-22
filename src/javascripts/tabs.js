function getWorkspaceById(workspaceId) {
    return WORKSPACES_DATA.find((workspace) => workspace.id === workspaceId) || null;
}

const SCRIPT_TAB_NAME_MAX_CHARS = 20;

function getTabDisplayName(name) {
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName) return 'Script';
    if (cleanName.length <= SCRIPT_TAB_NAME_MAX_CHARS) {
        return cleanName;
    }
    return `${cleanName.slice(0, SCRIPT_TAB_NAME_MAX_CHARS)}...`;
}

function getActiveWorkspace() {
    let workspace = getWorkspaceById(activeWorkspaceId);
    if (!workspace && WORKSPACES_DATA.length > 0) {
        workspace = WORKSPACES_DATA[0];
        activeWorkspaceId = workspace.id;
    }
    return workspace;
}

function getTabsForWorkspace(workspaceId) {
    const workspace = getWorkspaceById(workspaceId);
    if (!workspace) return [];

    const ordered = [];
    const seen = new Set();

    workspace.tabOrder.forEach((tabId) => {
        const tab = TABS_DATA.find((entry) => entry.id === tabId && entry.workspaceId === workspace.id);
        if (tab) {
            ordered.push(tab);
            seen.add(tab.id);
        }
    });

    TABS_DATA.forEach((tab) => {
        if (tab.workspaceId === workspace.id && !seen.has(tab.id)) {
            ordered.push(tab);
            workspace.tabOrder.push(tab.id);
        }
    });

    return ordered;
}

function setActiveWorkspace(workspaceId, { persist = true } = {}) {
    const workspace = getWorkspaceById(workspaceId);
    if (!workspace) return;

    activeWorkspaceId = workspace.id;
    window.safeStorage.setItem('zyronActiveWorkspaceId', activeWorkspaceId);
    renderWorkspaceList();
    renderAllTabs();
    if (persist) {
        saveState();
    }
}

function renderAllTabs() {
    const existingTabs = scriptTabBar.querySelectorAll('.script-tab');
    existingTabs.forEach((tabElement) => tabElement.remove());

    const workspace = getActiveWorkspace();
    if (!workspace) {
        activeTabId = null;
        return;
    }

    const workspaceTabs = getTabsForWorkspace(workspace.id);
    workspaceTabs.forEach((tab) => createTabElement(tab.id, tab.name));

    const activeTabInWorkspace = workspaceTabs.find((tab) => tab.id === activeTabId);
    if (activeTabInWorkspace) {
        switchTab(activeTabInWorkspace.id);
    } else if (workspaceTabs.length > 0) {
        switchTab(workspaceTabs[0].id);
    } else {
        if (activeTabId) {
            document.getElementById(`editor-${activeTabId}`)?.classList.add('hidden');
        }
        activeTabId = null;
    }
}

function beginInlineWorkspaceRename(workspaceId) {
    const workspace = getWorkspaceById(workspaceId);
    if (!workspace) return;

    const workspaceItem = workspaceList.querySelector(`.workspace-item[data-workspace-id="${workspaceId}"]`);
    if (!workspaceItem) return;
    const nameNode = workspaceItem.querySelector('.workspace-name');
    if (!nameNode) return;

    const renameInput = document.createElement('input');
    renameInput.className = 'workspace-name-input';
    renameInput.type = 'text';
    renameInput.value = workspace.name;
    renameInput.maxLength = 36;

    const commitRename = () => {
        const newName = renameInput.value.trim();
        if (!newName) {
            renderWorkspaceList();
            return;
        }
        workspace.name = newName;
        renderWorkspaceList();
        if (!autoexecuteModalOverlay.classList.contains('hidden')) {
            renderAutoexecuteDirectory();
        }
        saveState();
    };

    const cancelRename = () => renderWorkspaceList();

    renameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            commitRename();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelRename();
        }
    });
    renameInput.addEventListener('blur', commitRename);

    nameNode.replaceWith(renameInput);
    renameInput.focus();
    renameInput.select();
}

function renderWorkspaceList() {
    if (!workspaceList) return;
    workspaceList.innerHTML = '';

    WORKSPACES_DATA.forEach((workspace) => {
        const item = document.createElement('div');
        item.className = `workspace-item${workspace.id === activeWorkspaceId ? ' active' : ''}`;
        item.dataset.workspaceId = workspace.id;
        item.draggable = true;

        const itemMain = document.createElement('div');
        itemMain.className = 'workspace-item-main';

        const icon = document.createElement('img');
        icon.src = 'assets/images/folder.png';
        icon.alt = '';
        icon.className = 'workspace-icon';

        const name = document.createElement('span');
        name.className = 'workspace-name';
        name.title = workspace.name;
        name.textContent = workspace.name;

        itemMain.appendChild(icon);
        itemMain.appendChild(name);
        item.appendChild(itemMain);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'workspace-delete-btn';
        deleteButton.type = 'button';
        deleteButton.title = 'Delete folder';
        deleteButton.textContent = '×';
        item.appendChild(deleteButton);

        let clickTimer = null;
        item.addEventListener('click', () => {
            if (clickTimer) clearTimeout(clickTimer);
            clickTimer = setTimeout(() => {
                setActiveWorkspace(workspace.id);
                clickTimer = null;
            }, 170);
        });
        item.addEventListener('dblclick', (event) => {
            if (event.target.closest('.workspace-delete-btn')) return;
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }
            beginInlineWorkspaceRename(workspace.id);
        });

        item.addEventListener('contextmenu', (event) => {
            if (event.target.closest('.workspace-delete-btn')) return;
            event.preventDefault();
            event.stopPropagation();
            showContextMenu(event, { type: 'workspace', id: workspace.id });
        });

        deleteButton.addEventListener('click', (event) => {
            event.stopPropagation();
            deleteWorkspace(workspace.id);
        });

        item.addEventListener('dragstart', (event) => {
            event.dataTransfer.setData('application/x-zyron-workspace-id', workspace.id);
            event.dataTransfer.effectAllowed = 'move';
            setTimeout(() => item.classList.add('dragging'), 0);
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        });

        item.addEventListener('dragover', (event) => {
            event.preventDefault();
            const draggedWorkspaceId = event.dataTransfer.getData('application/x-zyron-workspace-id');
            const draggedTabId = event.dataTransfer.getData('application/x-zyron-tab-id');

            if (draggedWorkspaceId) {
                const draggingElement = workspaceList.querySelector('.workspace-item.dragging');
                if (!draggingElement || draggingElement === item) return;
                const rect = item.getBoundingClientRect();
                const insertBefore = event.clientY < rect.top + rect.height / 2;
                workspaceList.insertBefore(draggingElement, insertBefore ? item : item.nextSibling);
            } else if (draggedTabId) {
                item.classList.add('drop-target');
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drop-target');
        });

        item.addEventListener('drop', (event) => {
            event.preventDefault();
            item.classList.remove('drop-target');

            const draggedWorkspaceId = event.dataTransfer.getData('application/x-zyron-workspace-id');
            if (draggedWorkspaceId) {
                const newOrder = Array.from(workspaceList.querySelectorAll('.workspace-item'))
                    .map((node) => node.dataset.workspaceId);
                WORKSPACES_DATA.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
                renderWorkspaceList();
                saveState();
                return;
            }

            const draggedTabId = event.dataTransfer.getData('application/x-zyron-tab-id');
            if (draggedTabId) {
                moveTabToWorkspace(draggedTabId, workspace.id);
            }
        });

        workspaceList.appendChild(item);
    });
}

function createWorkspace() {
    const workspace = {
        id: `workspace-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: `folder ${WORKSPACES_DATA.length + 1}`,
        tabOrder: []
    };
    WORKSPACES_DATA.push(workspace);
    setActiveWorkspace(workspace.id, { persist: false });
    renderWorkspaceList();
    saveState();
}

function deleteWorkspace(workspaceId) {
    if (WORKSPACES_DATA.length <= 1) {
        showNotification('At least one workspace folder must exist.', 'error');
        return;
    }

    const workspace = getWorkspaceById(workspaceId);
    if (!workspace) return;

    const fallbackWorkspace = WORKSPACES_DATA.find((entry) => entry.id !== workspaceId);
    if (!fallbackWorkspace) return;

    const movedTabs = TABS_DATA.filter((tab) => tab.workspaceId === workspaceId);
    movedTabs.forEach((tab) => {
        tab.workspaceId = fallbackWorkspace.id;
        if (!fallbackWorkspace.tabOrder.includes(tab.id)) {
            fallbackWorkspace.tabOrder.push(tab.id);
        }
    });

    WORKSPACES_DATA = WORKSPACES_DATA.filter((entry) => entry.id !== workspaceId);
    if (activeWorkspaceId === workspaceId) {
        activeWorkspaceId = fallbackWorkspace.id;
    }

    renderWorkspaceList();
    renderAllTabs();
    saveState();
}

function moveTabToWorkspace(tabId, targetWorkspaceId) {
    const tab = TABS_DATA.find((entry) => entry.id === tabId);
    const targetWorkspace = getWorkspaceById(targetWorkspaceId);
    if (!tab || !targetWorkspace) return;
    if (tab.workspaceId === targetWorkspace.id) return;

    WORKSPACES_DATA.forEach((workspace) => {
        workspace.tabOrder = workspace.tabOrder.filter((entryId) => entryId !== tab.id);
    });

    tab.workspaceId = targetWorkspace.id;
    targetWorkspace.tabOrder.push(tab.id);

    if (activeWorkspaceId !== targetWorkspace.id) {
        setActiveWorkspace(targetWorkspace.id, { persist: false });
    } else {
        renderAllTabs();
    }

    saveState();
}

function beginInlineTabRename(tabId) {
    const tab = TABS_DATA.find((entry) => entry.id === tabId);
    if (!tab) return;
    const tabElement = document.getElementById(tabId);
    if (!tabElement) return;

    const nameNode = tabElement.querySelector('.tab-name');
    if (!nameNode) return;

    const renameInput = document.createElement('input');
    renameInput.type = 'text';
    renameInput.className = 'tab-name-input';
    renameInput.value = tab.name;
    renameInput.maxLength = SCRIPT_TAB_NAME_MAX_CHARS;

    const commitRename = () => {
        const newName = renameInput.value.trim();
        if (!newName) {
            renderAllTabs();
            return;
        }
        tab.name = newName;
        renderAllTabs();
        if (activeTabId === tab.id) {
            switchTab(tab.id);
        }
        if (!autoexecuteModalOverlay.classList.contains('hidden')) {
            renderAutoexecuteDirectory();
        }
        saveState();
    };

    const cancelRename = () => renderAllTabs();

    renameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            commitRename();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelRename();
        }
    });
    renameInput.addEventListener('blur', commitRename);

    nameNode.replaceWith(renameInput);
    renameInput.focus();
    renameInput.select();
}

function createTabElement(id, name) {
    const tabElement = document.createElement('div');
    tabElement.id = id;
    tabElement.className = 'script-tab';
    tabElement.draggable = true;

    const tabName = document.createElement('span');
    tabName.className = 'tab-name';
    tabName.title = name;
    tabName.textContent = getTabDisplayName(name);

    const closeButton = document.createElement('button');
    closeButton.className = 'close-btn';
    closeButton.type = 'button';
    closeButton.innerHTML = '&times;';
    closeButton.title = 'Close script';

    tabElement.dataset.fullName = name;
    tabElement.appendChild(tabName);
    tabElement.appendChild(closeButton);
    scriptTabBar.appendChild(tabElement);

    tabElement.addEventListener('click', (event) => {
        if (event.target.closest('.close-btn')) return;
        switchTab(id);
    });

    tabElement.addEventListener('dblclick', (event) => {
        if (event.target.closest('.close-btn')) return;
        beginInlineTabRename(id);
    });

    closeButton.addEventListener('click', (event) => {
        event.stopPropagation();
        closeTab(id);
    });

    tabElement.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        showContextMenu(event, { type: 'tab', id });
    });

    tabElement.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('application/x-zyron-tab-id', id);
        event.dataTransfer.setData('text/plain', id);
        event.dataTransfer.effectAllowed = 'move';
        setTimeout(() => tabElement.classList.add('dragging'), 0);
    });

    tabElement.addEventListener('dragend', () => {
        tabElement.classList.remove('dragging');
    });

    tabElement.addEventListener('dragover', (event) => {
        event.preventDefault();
        const draggingElement = scriptTabBar.querySelector('.script-tab.dragging');
        if (!draggingElement || draggingElement === tabElement) return;
        const rect = tabElement.getBoundingClientRect();
        const insertBefore = event.clientX < rect.left + rect.width / 2;
        scriptTabBar.insertBefore(draggingElement, insertBefore ? tabElement : tabElement.nextSibling);
    });
}

scriptTabBar.addEventListener('drop', (event) => {
    event.preventDefault();
    const draggedTabId = event.dataTransfer.getData('application/x-zyron-tab-id');
    if (!draggedTabId) return;

    const workspace = getActiveWorkspace();
    if (!workspace) return;

    const newOrder = Array.from(scriptTabBar.querySelectorAll('.script-tab')).map((tabNode) => tabNode.id);
    workspace.tabOrder = newOrder;
    saveState();
});

scriptTabBar.addEventListener('wheel', (event) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    if (scriptTabBar.scrollWidth <= scriptTabBar.clientWidth) return;
    event.preventDefault();
    scriptTabBar.scrollLeft += event.deltaY;
}, { passive: false });

function switchTab(id) {
    if (!id) return;
    const tab = TABS_DATA.find((entry) => entry.id === id);
    if (!tab) return;
    if (tab.workspaceId !== activeWorkspaceId) {
        setActiveWorkspace(tab.workspaceId, { persist: false });
    }
    if (activeTabId === id && document.getElementById(id)?.classList.contains('active')) return;

    if (activeTabId) {
        document.getElementById(activeTabId)?.classList.remove('active');
        document.getElementById(`editor-${activeTabId}`)?.classList.add('hidden');
    }

    activeTabId = id;
    window.safeStorage.setItem('zyronLastActiveTab', id);
    document.getElementById(id)?.classList.add('active');
    window.electronAPI.updateActiveScriptName(tab.name);

    let editorContainer = document.getElementById(`editor-${id}`);
    if (!editorContainer) {
        createEditorElement(tab.id, tab.content);
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

    const workspace = getActiveWorkspace();
    if (!workspace) return;

    const newId = `tab-${Date.now()}`;
    const newName = `Script ${TABS_DATA.length + 1}`;
    const tab = {
        id: newId,
        name: newName,
        content: '',
        workspaceId: workspace.id
    };

    TABS_DATA.push(tab);
    workspace.tabOrder.push(newId);
    renderAllTabs();
    switchTab(newId);
    saveState();
}

function closeTab(id) {
    const tabIndex = TABS_DATA.findIndex((entry) => entry.id === id);
    if (tabIndex === -1) return;
    const removedAutoExecuteEntry = AUTOEXECUTE_DATA && AUTOEXECUTE_DATA[id]
        ? { ...AUTOEXECUTE_DATA[id] }
        : null;

    TABS_DATA.splice(tabIndex, 1);
    WORKSPACES_DATA.forEach((workspace) => {
        workspace.tabOrder = workspace.tabOrder.filter((tabId) => tabId !== id);
    });

    if (AUTOEXECUTE_DATA && AUTOEXECUTE_DATA[id]) {
        delete AUTOEXECUTE_DATA[id];
    }

    editors[id]?.destroy();
    delete editors[id];
    document.getElementById(id)?.remove();
    document.getElementById(`editor-${id}`)?.remove();

    const activeWorkspaceTabs = getTabsForWorkspace(activeWorkspaceId);
    if (activeTabId === id) {
        activeTabId = null;
        if (activeWorkspaceTabs.length > 0) {
            switchTab(activeWorkspaceTabs[0].id);
        }
    }

    renderAllTabs();
    saveState();

    if (removedAutoExecuteEntry && window.electronAPI?.syncAutoexecuteScripts) {
        window.electronAPI.syncAutoexecuteScripts({
            executor: selectedExecutor,
            scripts: [
                {
                    id,
                    serial: removedAutoExecuteEntry.serial,
                    enabled: false,
                    content: ''
                }
            ]
        }).catch((error) => {
            console.error('Failed to remove deleted tab from autoexecute:', error);
        });
    }

    if (typeof window.syncAutoExecuteScripts === 'function') {
        window.syncAutoExecuteScripts({ notifyOnError: false });
    }
}

function initializeWorkspacePanel() {
    if (!workspaceAddBtn) return;
    workspaceAddBtn.addEventListener('click', createWorkspace);
    renderWorkspaceList();
}

window.beginInlineTabRename = beginInlineTabRename;
window.initializeWorkspacePanel = initializeWorkspacePanel;
window.renderWorkspaceList = renderWorkspaceList;
window.setActiveWorkspace = setActiveWorkspace;
