document.body.addEventListener('click', function(event) {
    // Prevent click effect when interacting with UI elements
    if (document.body.classList.contains('performance-mode')) return;
    if (event.target.closest('button, a, input, .script-tab, .context-menu-item')) {
        return;
    }
    const particle = document.createElement('div');
    particle.classList.add('click-effect');
    const size = Math.random() * 4 + 2;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${event.clientX - size / 2}px`;
    particle.style.top = `${event.clientY - size / 2}px`;
    document.body.appendChild(particle);
    setTimeout(() => { particle.remove(); }, 600);
});

document.addEventListener('DOMContentLoaded', () => {
    const loginView = document.getElementById('login-view');
    const mainAppView = document.getElementById('main-app-view');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username-input');
    const navScriptsBtn = document.getElementById('nav-scripts-btn');
    const navEditorBtn = document.getElementById('nav-editor-btn');
    const navSettingsBtn = document.getElementById('nav-settings-btn');
    const navAboutBtn = document.getElementById('nav-about-btn');
    const scriptsPane = document.getElementById('scripts-pane');
    const editorPane = document.getElementById('editor-pane');
    const settingsPane = document.getElementById('settings-pane');
    const aboutPane = document.getElementById('about-pane');
    const scriptTabBar = document.getElementById('script-tab-bar');
    const newTabBtn = document.getElementById('new-tab-btn');
    const editorArea = document.getElementById('editor-area');
    const executeBtn = document.getElementById('execute-btn');
    const contextMenu = document.getElementById('context-menu');
    const autoSaveToggle = document.getElementById('auto-save-toggle');
    const performanceModeToggle = document.getElementById('performance-mode-toggle');
    const discordRpcToggle = document.getElementById('discord-rpc-toggle');
    const notificationsToggle = document.getElementById('notifications-toggle');
    const renameUserBtn = document.getElementById('rename-user-btn');
    const clearDataBtn = document.getElementById('clear-data-btn');
    const renameModalOverlay = document.getElementById('rename-modal-overlay');
    const renameModalInput = document.getElementById('rename-modal-input');
    const renameModalSaveBtn = document.getElementById('rename-modal-save');
    const renameModalCancelBtn = document.getElementById('rename-modal-cancel');
    const connectionStatusIndicator = document.getElementById('status-indicator');
    const connectionStatusText = document.getElementById('status-text');
    const userDisplay = document.getElementById('user-display');
    const scriptSearchBox = document.getElementById('script-search-box');
    const confirmModalOverlay = document.getElementById('confirm-modal-overlay');

    let TABS_DATA = [];
    let activeTabId = null;
    let activeContextMenuTabId = null;
    const MAX_TABS = 30;
    const editors = {};
    let autoSaveInterval = null;
    let connectionCheckInterval = null;
    let notificationsEnabled = true;

    async function saveState() {
        if (TABS_DATA) {
            await window.electronAPI.saveState(TABS_DATA);
        }
    }

    function initApp() {
        const username = localStorage.getItem('zyronUsername');
        if (username) {
            showMainApp(username);
        } else {
            showLogin();
        }
        
        // Load settings
        const perfModeEnabled = localStorage.getItem('zyronPerfMode') === 'true';
        performanceModeToggle.checked = perfModeEnabled;
        if (perfModeEnabled) document.body.classList.add('performance-mode');

        notificationsEnabled = localStorage.getItem('zyronNotifications') !== 'false';
        notificationsToggle.checked = notificationsEnabled;

        window.electronAPI.getDiscordRpcStatus().then(isEnabled => {
            discordRpcToggle.checked = isEnabled;
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
        
        // Add script hub search functionality
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
        performanceModeToggle.addEventListener('change', togglePerformanceMode);
        notificationsToggle.addEventListener('change', toggleNotifications);
        discordRpcToggle.addEventListener('change', toggleDiscordRpc);

        window.electronAPI.onRequestFinalSave(async () => {
            await saveState();
            window.electronAPI.notifyFinalSaveComplete();
        });
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
        loadScriptCards(); // Load script cards initially
        checkConnection();
        if (connectionCheckInterval) clearInterval(connectionCheckInterval);
        connectionCheckInterval = setInterval(checkConnection, 3000);
        setupAutoSave();
    }

    async function handleLogin(event) {
        event.preventDefault();
        const username = usernameInput.value.trim();
        if (username) {
            localStorage.setItem('zyronUsername', username);
            showMainApp(username);
        }
    }
    
    function handleRenameUser() {
        document.getElementById('rename-modal-title').textContent = 'Change Name';
        renameModalInput.value = localStorage.getItem('zyronUsername') || '';
        renameModalOverlay.classList.remove('hidden');
        renameModalInput.focus();
    }

    function switchMainView(viewName) {
        scriptsPane.classList.add('hidden');
        editorPane.classList.add('hidden');
        settingsPane.classList.add('hidden');
        aboutPane.classList.add('hidden');
        
        navScriptsBtn.classList.remove('active');
        navEditorBtn.classList.remove('active');
        navSettingsBtn.classList.remove('active');
        navAboutBtn.classList.remove('active');

        if (viewName === 'scripts') {
            scriptsPane.classList.remove('hidden');
            navScriptsBtn.classList.add('active');
            loadScriptCards();
        } else if (viewName === 'editor') {
            editorPane.classList.remove('hidden');
            navEditorBtn.classList.add('active');
            Object.values(editors).forEach(editor => editor.resize());
        } else if (viewName === 'settings') {
            settingsPane.classList.remove('hidden');
            navSettingsBtn.classList.add('active');
        } else if (viewName === 'about') {
            aboutPane.classList.remove('hidden');
            navAboutBtn.classList.add('active');
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
             const lastActiveTab = TABS_DATA.find(t => t.id === localStorage.getItem('zyronLastActiveTab'));
             switchTab(lastActiveTab ? lastActiveTab.id : TABS_DATA[0].id);
        }
    }
    
    function setupAutoSave() {
        if (autoSaveInterval) clearInterval(autoSaveInterval);
        if (autoSaveToggle.checked) {
            autoSaveInterval = setInterval(saveState, 30000);
        }
    }

    function togglePerformanceMode() {
        const enabled = performanceModeToggle.checked;
        localStorage.setItem('zyronPerfMode', enabled);
        if (enabled) {
            document.body.classList.add('performance-mode');
        } else {
            document.body.classList.remove('performance-mode');
        }
    }

    function toggleNotifications() {
        notificationsEnabled = notificationsToggle.checked;
        localStorage.setItem('zyronNotifications', notificationsEnabled);
    }

    function toggleDiscordRpc() {
        const isEnabled = discordRpcToggle.checked;
        window.electronAPI.toggleDiscordRpc(isEnabled);
    }

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

    function createEditorElement(id, content) {
        const editorContainer = document.createElement('div');
        editorContainer.id = `editor-${id}`;
        editorContainer.className = 'editor-container hidden';
        editorArea.appendChild(editorContainer);

        const editor = ace.edit(editorContainer);
        editor.session.setMode("ace/mode/lua");
        editor.setTheme("ace/theme/twilight");
        editor.session.setValue(content || "");
        editor.setOptions({
            showPrintMargin: false,
            fontSize: "14px",
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            enableSnippets: true
        });

        editor.session.on('change', () => {
            const tab = TABS_DATA.find(t => t.id === id);
            if (tab) tab.content = editor.session.getValue();
        });
        editors[id] = editor;
    }

    function switchTab(id) {
        if (activeTabId === id) return;

        if (activeTabId) {
            document.getElementById(activeTabId)?.classList.remove('active');
            document.getElementById(`editor-${activeTabId}`)?.classList.add('hidden');
        }
        activeTabId = id;
        localStorage.setItem('zyronLastActiveTab', id);
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

    function showContextMenu(event, tabId) {
        activeContextMenuTabId = tabId;
        contextMenu.style.top = `${event.clientY}px`;
        contextMenu.style.left = `${event.clientX}px`;
        contextMenu.classList.remove('hidden');
    }
    
    function handleContextMenuClick(event) {
        if (!activeContextMenuTabId) return;
        const action = event.target.id;
        if (action === 'rename-tab-btn') {
            const tab = TABS_DATA.find(t => t.id === activeContextMenuTabId);
            if(tab) {
                document.getElementById('rename-modal-title').textContent = 'Rename Tab';
                renameModalInput.value = tab.name;
                renameModalOverlay.classList.remove('hidden');
                renameModalInput.focus();
            }
        }
        contextMenu.classList.add('hidden');
    }

    function saveTabRename() {
        const newName = renameModalInput.value.trim();
        if (newName && activeContextMenuTabId) {
            const tab = TABS_DATA.find(t => t.id === activeContextMenuTabId);
            if (tab) {
                tab.name = newName;
                document.querySelector(`#${activeContextMenuTabId} .tab-name`).textContent = tab.name;
                saveState();
            }
        } else if (newName && !activeContextMenuTabId) {
            // This is for renaming the user
            localStorage.setItem('zyronUsername', newName);
            userDisplay.textContent = `Welcome, ${newName}`;
            showNotification('Name changed successfully!');
        }
        renameModalOverlay.classList.add('hidden');
        activeContextMenuTabId = null; // Reset context
    }

    async function executeScript() {
        const scriptContent = editors[activeTabId]?.session.getValue();
        if (!scriptContent) return;
        executeBtn.textContent = 'Executing...';
        executeBtn.disabled = true;
        try {
            const result = await window.electronAPI.executeScript(scriptContent);
            if (result.success) {
                showNotification('Script executed successfully!');
            } else {
                showNotification(`Execution failed: ${result.message}`, 'error');
            }
        } catch(e) {
            showNotification(`Execution error: ${e.message}`, 'error');
        }
        finally {
            executeBtn.textContent = 'Execute';
            checkConnection();
        }
    }

    async function checkConnection() {
        const isConnected = await window.electronAPI.checkConnection();
        executeBtn.disabled = !isConnected;
        if (isConnected) {
            connectionStatusIndicator.classList.remove('disconnected');
            connectionStatusIndicator.classList.add('connected');
            connectionStatusText.textContent = 'Connected';
        } else {
            connectionStatusIndicator.classList.remove('connected');
            connectionStatusIndicator.classList.add('disconnected');
            connectionStatusText.textContent = 'Disconnected';
        }
    }

    function filterTabs() {
        const query = scriptSearchBox.value.toLowerCase();
        const tabs = scriptTabBar.querySelectorAll('.script-tab');
        tabs.forEach(tab => {
            const tabName = tab.querySelector('.tab-name').textContent.toLowerCase();
            if (tabName.includes(query)) {
                tab.style.display = '';
            } else {
                tab.style.display = 'none';
            }
        });
    }

    function filterScriptCards() {
        const scriptHubSearch = document.getElementById('script-hub-search');
        const query = scriptHubSearch.value.toLowerCase();
        const cards = document.querySelectorAll('.script-card');
        
        cards.forEach(card => {
            const title = card.querySelector('.script-title').textContent.toLowerCase();
            const description = card.querySelector('.script-description').textContent.toLowerCase();
            
            if (title.includes(query) || description.includes(query)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }

    function showNotification(message, type = 'info') {
        if (!notificationsEnabled) return;
        
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        // Trigger the animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Remove the notification after a delay
        setTimeout(() => {
            notification.classList.remove('show');
            notification.addEventListener('transitionend', () => {
                notification.remove();
            });
        }, 5000);
    }

    function showConfirmationModal(title, text, onConfirm) {
        document.getElementById('confirm-modal-title').textContent = title;
        document.getElementById('confirm-modal-text').textContent = text;
        const confirmBtn = document.getElementById('confirm-modal-confirm');
        const cancelBtn = document.getElementById('confirm-modal-cancel');
        
        const confirmHandler = () => {
            onConfirm();
            hide();
        };
        const cancelHandler = () => hide();

        const hide = () => {
            confirmModalOverlay.classList.add('hidden');
            confirmBtn.removeEventListener('click', confirmHandler);
            cancelBtn.removeEventListener('click', cancelHandler);
        };

        confirmBtn.addEventListener('click', confirmHandler);
        cancelBtn.addEventListener('click', cancelHandler);
        confirmModalOverlay.classList.remove('hidden');
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

    async function loadChangelog() {
        const changelogData = await window.electronAPI.getChangelog();
        if (changelogData) {
            document.getElementById('app-version').textContent = `Build: ${changelogData.latestVersion}`;
            const container = document.getElementById('changelog-container');
            container.innerHTML = '';
            changelogData.changelogs.forEach(log => {
                const entry = document.createElement('div');
                entry.className = 'changelog-entry';
                const changesHtml = log.changes.map(c => `<li>${c}</li>`).join('');
                entry.innerHTML = `<h3>Version ${log.version} <span style="font-size: 0.8em; color: var(--text-muted);">(${log.date})</span></h3><ul>${changesHtml}</ul>`;
                container.appendChild(entry);
            });
        }
    }

    initApp();

    // Update Modal Functionality
    setupUpdateModal();

    // Script Cards Functionality
    async function loadScriptCards() {
        const container = document.getElementById('script-cards-container');
        try {
            const scripts = await window.electronAPI.getScripts();
            container.innerHTML = '';
            
            if (scripts && scripts.length > 0) {
                scripts.forEach(script => {
                    const card = createScriptCard(script);
                    container.appendChild(card);
                });
            } else {
                container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No scripts found. Add scripts to the src/scripts folder.</p>';
            }
        } catch (error) {
            console.error('Failed to load scripts:', error);
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Failed to load scripts.</p>';
        }
    }

    function createScriptCard(script) {
        const card = document.createElement('div');
        card.className = 'script-card';
        
        const thumbnail = script.thumbnail ? 
            `<img src="file://${script.thumbnail}" alt="${script.name}" onerror="this.parentElement.innerHTML='${script.name}'">`
            : script.name;
        
        card.innerHTML = `
            <div class="script-thumbnail">
                ${thumbnail}
            </div>
            <div class="script-info">
                <h3 class="script-title">${script.name}</h3>
                <p class="script-description">${script.description || 'No description available.'}</p>
                <button class="script-execute-btn" onclick="executeHubScript('${script.path}')">Execute</button>
            </div>
        `;
        
        return card;
    }

    window.executeHubScript = async function(scriptPath) {
        try {
            const result = await window.electronAPI.executeHubScript(scriptPath);
            if (result.success) {
                showNotification('Script executed successfully!');
            } else {
                showNotification(`Execution failed: ${result.message}`, 'error');
            }
        } catch (error) {
            showNotification(`Execution error: ${error.message}`, 'error');
        }
    };
});

function setupUpdateModal() {
    const updateModalOverlay = document.getElementById('update-modal-overlay');
    const updateModalText = document.getElementById('update-modal-text');
    const updateModalActions = document.getElementById('update-modal-actions');
    const updateProgress = document.getElementById('update-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const updateModalYes = document.getElementById('update-modal-yes');
    const updateModalNo = document.getElementById('update-modal-no');

    let updateInfo = null;

    // Listen for update events from main process
    window.electronAPI.onUpdateAvailable((event, info) => {
        updateInfo = info;
        updateModalText.textContent = `Version ${info.version} is available. Would you like to install it now?`;
        showUpdateModal();
    });

    window.electronAPI.onDownloadProgress((event, progressObj) => {
        const percent = Math.round(progressObj.percent);
        progressFill.style.width = `${percent}%`;
        progressText.textContent = `Downloading update... ${percent}%`;
    });

    window.electronAPI.onUpdateDownloaded((event, info) => {
        updateProgress.classList.add('hidden');
        updateModalActions.classList.remove('hidden');
        updateModalText.textContent = 'Update downloaded successfully! Click "Install Now" to restart and apply the update.';
        updateModalYes.textContent = 'Install Now';
        updateModalYes.onclick = () => {
            window.electronAPI.installUpdate();
        };
    });

    function showUpdateModal() {
        updateModalOverlay.classList.remove('hidden');
    }

    function hideUpdateModal() {
        updateModalOverlay.classList.add('hidden');
        resetUpdateModal();
    }

    function resetUpdateModal() {
        updateProgress.classList.add('hidden');
        updateModalActions.classList.remove('hidden');
        progressFill.style.width = '0%';
        progressText.textContent = 'Downloading update...';
        updateModalYes.textContent = 'Install Update';
        updateModalYes.onclick = startUpdateDownload;
    }

    function startUpdateDownload() {
        updateModalActions.classList.add('hidden');
        updateProgress.classList.remove('hidden');
        updateModalText.textContent = 'Downloading update, please wait...';
        
        // Trigger the download
        window.electronAPI.downloadUpdate().catch(error => {
            console.error('Failed to start download:', error);
            // Reset modal on error
            updateModalActions.classList.remove('hidden');
            updateProgress.classList.add('hidden');
            updateModalText.textContent = 'Failed to start download. Please try again.';
        });
    }

    // Event listeners
    updateModalYes.addEventListener('click', startUpdateDownload);
    updateModalNo.addEventListener('click', hideUpdateModal);

    // Test function - can be called from dev console
    window.testUpdateModal = () => {
        updateInfo = { version: '1.2.0' };
        updateModalText.textContent = `Version ${updateInfo.version} is available. Would you like to install it now?`;
        showUpdateModal();
    };
}
