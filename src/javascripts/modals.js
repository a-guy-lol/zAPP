function clearRenameContext() {
    activeContextMenuTabId = null;
    activeContextMenuWorkspaceId = null;
    activeContextMenuType = null;
}

function resolveContextTarget(target) {
    if (typeof target === 'string') {
        return { type: 'tab', id: target };
    }
    if (!target || typeof target !== 'object') {
        return null;
    }
    const targetType = target.type === 'workspace' ? 'workspace' : 'tab';
    const targetId = typeof target.id === 'string' ? target.id.trim() : '';
    if (!targetId) return null;
    return { type: targetType, id: targetId };
}

function showContextMenu(event, target) {
    const resolvedTarget = resolveContextTarget(target);
    if (!resolvedTarget) return;

    clearRenameContext();
    activeContextMenuType = resolvedTarget.type;
    if (resolvedTarget.type === 'workspace') {
        activeContextMenuWorkspaceId = resolvedTarget.id;
    } else {
        activeContextMenuTabId = resolvedTarget.id;
    }

    const renameButton = document.getElementById('rename-tab-btn');
    if (renameButton) {
        renameButton.textContent = resolvedTarget.type === 'workspace' ? 'Rename Folder' : 'Rename Script';
    }

    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.classList.remove('hidden');
}

function handleContextMenuClick(event) {
    if (!activeContextMenuType) return;
    const action = event.target.id;
    let openedRenameModal = false;
    if (action === 'rename-tab-btn') {
        if (activeContextMenuType === 'workspace' && activeContextMenuWorkspaceId) {
            const workspace = getWorkspaceById(activeContextMenuWorkspaceId);
            if (workspace) {
                document.getElementById('rename-modal-title').textContent = 'Rename Folder';
                renameModalInput.value = workspace.name;
                renameModalInput.maxLength = 36;
                renameModalOverlay.classList.remove('hidden');
                renameModalInput.focus();
                renameModalInput.select();
                openedRenameModal = true;
            }
        } else if (activeContextMenuType === 'tab' && activeContextMenuTabId) {
            const tab = TABS_DATA.find((entry) => entry.id === activeContextMenuTabId);
            if (!tab) {
                contextMenu.classList.add('hidden');
                clearRenameContext();
                return;
            }
            document.getElementById('rename-modal-title').textContent = 'Rename Script';
            renameModalInput.value = tab.name;
            renameModalInput.maxLength = 20;
            renameModalOverlay.classList.remove('hidden');
            renameModalInput.focus();
            renameModalInput.select();
            openedRenameModal = true;
        }
    }
    contextMenu.classList.add('hidden');
    if (!openedRenameModal) {
        clearRenameContext();
    }
}

function saveTabRename() {
    const newName = renameModalInput.value.trim();
    if (newName && activeContextMenuType === 'workspace' && activeContextMenuWorkspaceId) {
        const workspace = getWorkspaceById(activeContextMenuWorkspaceId);
        if (workspace) {
            workspace.name = newName;
            renderWorkspaceList();
            if (!autoexecuteModalOverlay.classList.contains('hidden')) {
                renderAutoexecuteDirectory();
            }
            saveState();
        }
    } else if (newName && activeContextMenuType === 'tab' && activeContextMenuTabId) {
        const tab = TABS_DATA.find((entry) => entry.id === activeContextMenuTabId);
        if (tab) {
            tab.name = newName.slice(0, 20);
            renderAllTabs();
            if (activeTabId === tab.id) {
                switchTab(tab.id);
            }
            if (!autoexecuteModalOverlay.classList.contains('hidden')) {
                renderAutoexecuteDirectory();
            }
            saveState();
        }
    } else if (newName && !activeContextMenuType) {
        // This is for renaming the user
        if (typeof window.persistUsername === 'function') {
            window.persistUsername(newName);
        } else {
            window.safeStorage.setItem('zyronUsername', newName);
        }
        showNotification('Name changed successfully!');
    }
    renameModalOverlay.classList.add('hidden');
    clearRenameContext();
}

window.clearRenameContext = clearRenameContext;

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

    window.electronAPI.onUpdateLog((event, logMessage) => {
        console.log('[AUTO-UPDATER]', logMessage);
    });

    window.electronAPI.onUpdateAvailable((event, info) => {
        updateInfo = info;
        resetUpdateModal();
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

    window.electronAPI.onUpdateError((event, error) => {
        console.error('Update error:', error);
        updateProgress.classList.add('hidden');
        updateModalActions.classList.remove('hidden');
        updateModalText.textContent = `Update failed: ${error.error}`;
        updateModalYes.textContent = 'Try Again';
        updateModalYes.onclick = startUpdateDownload;
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
        
        window.electronAPI.downloadUpdate().catch(error => {
            console.error('Failed to start download:', error);
            updateModalActions.classList.remove('hidden');
            updateProgress.classList.add('hidden');
            updateModalText.textContent = 'Failed to start download. Please try again.';
        });
    }

    updateModalYes.onclick = startUpdateDownload;
    updateModalNo.addEventListener('click', hideUpdateModal);

    window.testUpdateModal = async () => {
        try {
            const response = await fetch('https://api.github.com/repos/a-guy-lol/zAPP/releases/latest');
            const latestRelease = await response.json();
            updateInfo = { version: latestRelease.tag_name.replace('v', '') };
            updateModalText.textContent = `Version ${updateInfo.version} is available. Would you like to install it now?`;
            showUpdateModal();
        } catch (error) {
            console.error('Failed to fetch latest version:', error);
            updateInfo = { version: '1.4.1' };
            updateModalText.textContent = `Version ${updateInfo.version} is available. Would you like to install it now?`;
            showUpdateModal();
        }
    };

    window.checkForUpdatesManually = async () => {
        try {
            console.log('Manually checking for updates...');
            
            const isDev = await window.electronAPI.isDevelopment();
            const result = isDev 
                ? await window.electronAPI.checkForUpdatesForce()
                : await window.electronAPI.checkForUpdates();
                
            console.log('Update check result:', result);
            
            if (result.success && result.updateInfo) {
                console.log('Update found:', result.updateInfo);
                const info = result.updateInfo.updateInfo || result.updateInfo;
                if (info && info.version) {
                    updateInfo = info;
                    updateModalText.textContent = `Version ${updateInfo.version} is available. Would you like to install it now?`;
                    showUpdateModal();
                }
            } else {
                console.log('No updates available or check failed:', result.message || result.error);
                alert(`Update check: ${result.message || result.error || 'No updates available'}`);
            }
        } catch (error) {
            console.error('Manual update check failed:', error);
            alert(`Update check failed: ${error.message}`);
        }
    };
}

function setupScriptSettingsModal() {
    const scriptSettingsModal = document.getElementById('script-settings-modal-overlay');
    const scriptSettingsDone = document.getElementById('script-settings-done');
    const executeOnJoinToggle = document.getElementById('execute-on-join-toggle');
    const executeOnJoinSetting = executeOnJoinToggle.closest('.setting-item');
    const setKeySetting = document.getElementById('set-key-setting');
    const scriptKeyInput = document.getElementById('script-key-input');
    
    let saveKeyTimeout = null;
    let saveExecuteOnJoinTimeout = null;

    function getCurrentScriptRef() {
        if (!currentScriptForSettings) {
            return null;
        }
        return {
            scriptId: currentScriptForSettings.id || '',
            scriptName: currentScriptForSettings.name || ''
        };
    }

    // Debounced save for key changes
    function debouncedSaveKey() {
        if (saveKeyTimeout) clearTimeout(saveKeyTimeout);
        saveKeyTimeout = setTimeout(async () => {
            if (currentScriptForSettings) {
                const settings = {
                    executeOnJoin: executeOnJoinToggle.checked,
                    savedKey: scriptKeyInput.value.trim()
                };
                
                try {
                    await window.electronAPI.saveScriptSettings(getCurrentScriptRef(), settings);
                    console.log('Auto-saved key for', currentScriptForSettings.name);
                    if (executeOnJoinToggle.checked && typeof window.syncAutoExecuteScripts === 'function') {
                        await window.syncAutoExecuteScripts({ notifyOnError: true });
                    }
                } catch (error) {
                    console.error('Failed to auto-save script key:', error);
                }
            }
        }, 1000); // Save 1 second after user stops typing
    }

    // Debounced save for execute on join changes
    function debouncedSaveExecuteOnJoin() {
        if (saveExecuteOnJoinTimeout) clearTimeout(saveExecuteOnJoinTimeout);
        saveExecuteOnJoinTimeout = setTimeout(async () => {
            if (currentScriptForSettings) {
                const settings = {
                    executeOnJoin: executeOnJoinToggle.checked,
                    savedKey: scriptKeyInput.value.trim()
                };
                
                try {
                    await window.electronAPI.saveScriptSettings(getCurrentScriptRef(), settings);
                    console.log('Auto-saved execute on join for', currentScriptForSettings.name);
                    if (typeof window.syncAutoExecuteScripts === 'function') {
                        await window.syncAutoExecuteScripts({ notifyOnError: true });
                    }
                } catch (error) {
                    console.error('Failed to auto-save execute on join:', error);
                }
            }
        }, 500); // Save quickly for toggles
    }

    scriptKeyInput.addEventListener('input', debouncedSaveKey);
    executeOnJoinToggle.addEventListener('change', () => {
        debouncedSaveExecuteOnJoin();
    });

    scriptSettingsDone.addEventListener('click', () => {
        scriptSettingsModal.classList.add('hidden');
    });

    // Show/hide set key setting based on script type
    window.showScriptSettings = async function(script) {
        currentScriptForSettings = script;
        document.getElementById('script-settings-modal-title').textContent = `${script.name} Settings`;
        
        // Reset fields first
        executeOnJoinToggle.checked = false;
        scriptKeyInput.value = '';
        
        try {
            const result = await window.electronAPI.loadScriptSettings({
                scriptId: script.id || '',
                scriptName: script.name
            });
            if (result.success && result.settings) {
                executeOnJoinToggle.checked = result.settings.executeOnJoin || false;
                scriptKeyInput.value = result.settings.savedKey || '';
                console.log('Loaded settings for', script.name, ':', result.settings); // Debug log
            } else {
                console.log('No settings found for', script.name);
            }
        } catch (error) {
            console.error('Failed to load script settings:', error);
        }
        
        const showSetKey = script.type === 'paid' || script.type === 'paid-key-system' || script.type === 'paid-free';
        setKeySetting.style.display = showSetKey ? '' : 'none';
        const supportsExecuteOnJoin = script.supportsExecuteOnJoin !== false;
        executeOnJoinSetting.style.display = supportsExecuteOnJoin ? '' : 'none';
        executeOnJoinToggle.disabled = !supportsExecuteOnJoin;
        if (!supportsExecuteOnJoin) {
            executeOnJoinToggle.checked = false;
        }
        
        scriptSettingsModal.classList.remove('hidden');
    };
}
