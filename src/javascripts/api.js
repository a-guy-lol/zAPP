async function checkConnection() {
    const isRobloxConnected = await window.electronAPI.checkConnection();
    executeBtn.disabled = !isRobloxConnected;
    
    if (isRobloxConnected) {
        robloxStatusIndicator.classList.remove('disconnected');
        robloxStatusIndicator.classList.add('connected');
        robloxStatusText.textContent = 'Connected';
    } else {
        robloxStatusIndicator.classList.remove('connected');
        robloxStatusIndicator.classList.add('disconnected');
        robloxStatusText.textContent = 'Disconnected';
    }

    executorStatusIndicator.classList.remove('connected', 'disconnected');
    executorStatusIndicator.classList.add(isRobloxConnected ? 'connected' : 'disconnected');
}

async function loadChangelog() {
    const changelogData = await window.electronAPI.getChangelog();
    if (changelogData) {
        document.getElementById('app-version').textContent = `Build ${changelogData.latestVersion}`;
        const container = document.getElementById('changelog-container');
        container.innerHTML = '';
        
        changelogData.changelogs.forEach(log => {
            const entry = document.createElement('div');
            entry.className = 'changelog-entry';
            
            // Determine if this is a major or minor version
            const versionType = determineMajorMinor(log.version);
            entry.dataset.type = versionType;
            
            // Simple changelog formatting without hardcoded change types
            const changesHtml = log.changes.map(change => `<li>${change}</li>`).join('');
            
            entry.innerHTML = `
                <div class="version-info">
                    <span class="version-badge">v${log.version}</span>
                    <span class="changelog-date">${log.date}</span>
                </div>
                <h3>Version ${log.version}</h3>
                <ul>${changesHtml}</ul>
            `;
            container.appendChild(entry);
        });
        
        // Setup filter functionality
        setupChangelogFilters();
    }
}

function determineMajorMinor(version) {
    // Remove 'v' if present and split by dots
    const versionParts = version.replace('v', '').split('.').map(num => parseInt(num));
    
    // If it's just a single number (like "2" or "1"), it's major
    if (versionParts.length === 1) {
        return 'major';
    }
    
    // For x.y.z format:
    if (versionParts.length >= 2) {
        const patch = versionParts[2] || 0;
        
        // Major versions: x.y.0 (any version ending in .0)
        // Examples: 1.0.0, 1.2.0, 1.3.0, 2.0.0
        if (patch === 0) {
            return 'major';
        }
        
        // Minor versions: x.y.z where z > 0
        // Examples: 1.2.1, 1.5.2, 1.3.1
        return 'minor';
    }
    
    return 'minor'; // Default fallback
}

function setupChangelogFilters() {
    const filterBtns = document.querySelectorAll('.changelog-filters .filter-btn');
    const entries = document.querySelectorAll('.changelog-entry');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            filterBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            
            entries.forEach(entry => {
                if (filter === 'all') {
                    entry.style.display = 'block';
                } else {
                    const entryType = entry.dataset.type || 'minor';
                    entry.style.display = entryType === filter ? 'block' : 'none';
                }
            });
        });
    });
}
