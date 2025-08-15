function filterScriptCards() {
    const scriptHubSearch = document.getElementById('script-hub-search');
    const query = scriptHubSearch.value.toLowerCase();
    const cards = document.querySelectorAll('.script-card');
    
    cards.forEach(card => {
        const title = card.querySelector('.script-title').textContent.toLowerCase();
        const description = card.querySelector('.script-description').textContent.toLowerCase();
        const scriptType = card.dataset.scriptType;
        
        // Check search query match
        const matchesSearch = !query || title.includes(query) || description.includes(query);
        
        // Check filter match
        let matchesFilter = false;
        switch (currentFilter) {
            case 'all':
                matchesFilter = true;
                break;
            case 'free':
                matchesFilter = scriptType === 'free' || scriptType === 'key-system' || scriptType === 'paid-free';
                break;
            case 'paid':
                matchesFilter = scriptType === 'paid' || scriptType === 'paid-key-system' || scriptType === 'paid-free';
                break;
            default:
                matchesFilter = true;
        }
        
        if (matchesSearch && matchesFilter) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

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
    card.dataset.scriptType = script.type || 'free';
    
    const thumbnail = script.thumbnail ? 
        `<img src="file://${script.thumbnail}" alt="${script.name}" onerror="this.parentElement.innerHTML='${script.name}'">`
        : script.name;
    
    // Determine type badge
    const typeBadge = getTypeBadge(script.type);
    
    card.innerHTML = `
        <div class="script-thumbnail">
            ${thumbnail}
        </div>
        ${typeBadge}
        <button class="script-settings-btn" onclick="showScriptSettings(${JSON.stringify(script).replace(/"/g, '&quot;')})">
            <img src="assets/images/settingsIcon.png" alt="Settings">
        </button>
        <div class="script-info">
            <h3 class="script-title">${script.name}</h3>
            <p class="script-description">${script.description || 'No description available.'}</p>
            <button class="script-execute-btn" onclick="executeHubScript('${script.path}', '${script.name}', '${script.type}')">Execute</button>
        </div>
    `;
    
    return card;
}

function getTypeBadge(type) {
    const badges = {
        'free': '<div class="script-type-badge free">Free</div>',
        'key-system': '<div class="script-type-badge key-system">Key System</div>',
        'paid': '<div class="script-type-badge paid">Paid</div>',
        'paid-key-system': '<div class="script-type-badge paid-key-system">Paid + Key</div>',
        'paid-free': '<div class="script-type-badge paid-free">Free/Paid</div>'
    };
    return badges[type] || badges['free'];
}

window.executeHubScript = async function(scriptPath, scriptName, scriptType) {
    try {
        // Load script settings to check for saved key
        let savedKey = '';
        let useZexiumAPI = false;
        
        try {
            const settingsResult = await window.electronAPI.loadScriptSettings(scriptName);
            if (settingsResult.success) {
                savedKey = settingsResult.settings.savedKey || '';
                // Use Zexium API only if it's enabled and execute on join is enabled
                useZexiumAPI = isZexiumAPIEnabled && settingsResult.settings.executeOnJoin;
                console.log('Executing', scriptName, 'with key:', savedKey, 'useZexium:', useZexiumAPI); // Debug log
            }
        } catch (error) {
            console.error('Failed to load script settings:', error);
        }
        
        const result = await window.electronAPI.executeHubScript(scriptPath, useZexiumAPI, savedKey);
        if (result.success) {
            showNotification('Script executed successfully!');
        } else {
            showNotification(`Execution failed: ${result.message}`, 'error');
        }
    } catch (error) {
        showNotification(`Execution error: ${error.message}`, 'error');
    }
};
