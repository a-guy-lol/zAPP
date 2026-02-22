let currentScriptsSource = 'zexon';

const SCRIPTBLOX_MAX_RESULTS = 20;
const SCRIPTBLOX_RETRY_ATTEMPTS = 5;
const SCRIPTBLOX_RETRY_DELAY_MS = 1000;

let scriptbloxQuery = '';
let scriptbloxPage = 1;
let scriptbloxTotalPages = 1;
let scriptbloxIsLoading = false;
let scriptbloxLoadToken = 0;
let scriptbloxSearchDebounce = null;
let scriptbloxControlsInitialized = false;
const scriptbloxContentCache = new Map();

function normalizeScriptsSource(source) {
    return source === 'scriptblox' ? 'scriptblox' : 'zexon';
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeScriptType(type) {
    const normalized = String(type || '').trim().toLowerCase();
    const knownTypes = new Set(['free', 'key-system', 'paid', 'paid-key-system', 'paid-free']);
    return knownTypes.has(normalized) ? normalized : 'free';
}

function createTypeBadgeElement(type) {
    const badge = document.createElement('div');
    const normalizedType = normalizeScriptType(type);
    badge.className = `script-type-badge ${normalizedType}`;

    if (normalizedType === 'key-system') {
        badge.textContent = 'Key System';
    } else if (normalizedType === 'paid-key-system') {
        badge.textContent = 'Paid + Key';
    } else if (normalizedType === 'paid-free') {
        badge.textContent = 'Free/Paid';
    } else if (normalizedType === 'paid') {
        badge.textContent = 'Paid';
    } else {
        badge.textContent = 'Free';
    }

    return badge;
}

function toScriptbloxAbsoluteUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('//')) return `https:${raw}`;
    if (raw.startsWith('/')) return `https://scriptblox.com${raw}`;
    return `https://scriptblox.com/${raw.replace(/^\/+/, '')}`;
}

function getScriptbloxThumbnail(script) {
    const candidates = [
        script?.image,
        script?.thumbnail,
        script?.game?.imageUrl,
        script?.game?.image
    ];

    for (const candidate of candidates) {
        const normalized = toScriptbloxAbsoluteUrl(candidate);
        if (normalized) {
            return normalized;
        }
    }

    return '';
}

function applyScriptsSourceUI() {
    const isZexon = currentScriptsSource === 'zexon';

    if (scriptsZexonPage) {
        scriptsZexonPage.classList.toggle('hidden', !isZexon);
    }
    if (scriptsScriptbloxPage) {
        scriptsScriptbloxPage.classList.toggle('hidden', isZexon);
    }
    if (scriptsSourceZexonBtn) {
        scriptsSourceZexonBtn.classList.toggle('active', isZexon);
    }
    if (scriptsSourceScriptbloxBtn) {
        scriptsSourceScriptbloxBtn.classList.toggle('active', !isZexon);
    }
}

function updateScriptbloxHeaderTitle() {
    if (!scriptbloxHeaderTitle) return;

    if (scriptbloxQuery) {
        scriptbloxHeaderTitle.textContent = 'ScriptBlox Search';
    } else {
        scriptbloxHeaderTitle.textContent = 'ScriptBlox Trending';
    }
}

function setScriptbloxStatus(message, { isError = false } = {}) {
    if (!scriptbloxStatus) return;

    const text = String(message || '').trim();
    if (!text) {
        scriptbloxStatus.classList.add('hidden');
        scriptbloxStatus.classList.remove('error');
        scriptbloxStatus.textContent = '';
        return;
    }

    scriptbloxStatus.textContent = text;
    scriptbloxStatus.classList.remove('hidden');
    scriptbloxStatus.classList.toggle('error', isError);
}

function updateScriptbloxPagination() {
    if (!scriptbloxPageLabel || !scriptbloxPrevBtn || !scriptbloxNextBtn) return;

    const isSearching = Boolean(scriptbloxQuery);
    const safePage = isSearching ? Math.max(1, scriptbloxPage) : 1;
    const safeTotalPages = isSearching ? Math.max(1, scriptbloxTotalPages) : 1;

    if (scriptbloxPagination) {
        scriptbloxPagination.classList.toggle('hidden', !isSearching);
    }

    scriptbloxPageLabel.textContent = String(safePage);
    scriptbloxPrevBtn.disabled = scriptbloxIsLoading || !isSearching || safePage <= 1;
    scriptbloxNextBtn.disabled = scriptbloxIsLoading || !isSearching || safePage >= safeTotalPages;
}

function setScriptbloxLoading(isLoading) {
    scriptbloxIsLoading = Boolean(isLoading);

    if (scriptbloxSearchInput) {
        scriptbloxSearchInput.disabled = scriptbloxIsLoading;
    }

    updateScriptbloxPagination();
}

function buildScriptbloxIdentifiers(script) {
    const identifiers = [];
    const id = String(script?._id || '').trim();
    const slug = String(script?.slug || '').trim();

    if (id) identifiers.push(id);
    if (slug && !identifiers.includes(slug)) identifiers.push(slug);

    return identifiers;
}

function resolveScriptbloxScriptFromPayload(payload) {
    if (!payload) return '';

    if (typeof payload.script === 'string') {
        return payload.script;
    }

    if (payload.script && typeof payload.script.script === 'string') {
        return payload.script.script;
    }

    return '';
}

async function resolveScriptbloxScriptContent(script) {
    const inlineContent = resolveScriptbloxScriptFromPayload(script);
    if (inlineContent && inlineContent.trim()) {
        const ids = buildScriptbloxIdentifiers(script);
        ids.forEach((identifier) => scriptbloxContentCache.set(identifier, inlineContent));
        return inlineContent;
    }

    const identifiers = buildScriptbloxIdentifiers(script);
    if (identifiers.length === 0) {
        throw new Error('Script identifier is unavailable.');
    }

    for (const identifier of identifiers) {
        const cached = scriptbloxContentCache.get(identifier);
        if (typeof cached === 'string' && cached.trim()) {
            return cached;
        }
    }

    let lastError = 'Script content unavailable.';
    for (const identifier of identifiers) {
        const result = await window.electronAPI.scriptbloxGetScriptContent(identifier);
        if (result?.success && typeof result.content === 'string' && result.content.trim()) {
            identifiers.forEach((entry) => scriptbloxContentCache.set(entry, result.content));
            return result.content;
        }
        if (result?.error) {
            lastError = result.error;
        }
    }

    throw new Error(lastError);
}

async function copyTextToClipboard(text) {
    let lastError = '';

    if (window.electronAPI?.clipboardWriteText) {
        try {
            const result = await window.electronAPI.clipboardWriteText(text);
            if (result?.success) {
                return;
            }
            if (result?.error) {
                lastError = result.error;
            }
        } catch (error) {
            lastError = error.message || lastError;
        }
    }

    if (navigator?.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch (error) {
            lastError = error.message || lastError;
        }
    }

    const tempArea = document.createElement('textarea');
    tempArea.value = text;
    tempArea.setAttribute('readonly', 'readonly');
    tempArea.style.position = 'absolute';
    tempArea.style.left = '-9999px';
    document.body.appendChild(tempArea);
    tempArea.select();

    const copied = document.execCommand('copy');
    document.body.removeChild(tempArea);
    if (!copied) {
        throw new Error(lastError || 'Clipboard copy failed.');
    }
}

async function withBusyButton(button, busyLabel, callback) {
    if (typeof callback !== 'function') {
        return;
    }

    if (!button) {
        return callback();
    }

    const previousLabel = button.textContent;
    const previousDisabled = button.disabled;

    button.disabled = true;
    button.textContent = busyLabel;

    try {
        await callback();
    } finally {
        button.textContent = previousLabel;
        button.disabled = previousDisabled;
    }
}

function createScriptbloxCard(script) {
    const card = document.createElement('div');
    card.className = 'script-card scriptblox-card';
    card.dataset.scriptType = normalizeScriptType(script?.scriptType || script?.type || 'free');

    const title = String(script?.title || script?.name || 'Untitled Script').trim() || 'Untitled Script';
    const gameName = String(script?.game?.name || '').trim();

    const thumbnail = document.createElement('div');
    thumbnail.className = 'script-thumbnail';

    const thumbnailUrl = getScriptbloxThumbnail(script);
    if (thumbnailUrl) {
        const image = document.createElement('img');
        image.src = thumbnailUrl;
        image.alt = title;
        image.loading = 'lazy';
        image.addEventListener('error', () => {
            thumbnail.textContent = title;
        });
        thumbnail.appendChild(image);
    } else {
        thumbnail.textContent = title;
    }

    const scriptType = normalizeScriptType(script?.scriptType || script?.type || 'free');
    const badge = scriptType === 'free' ? null : createTypeBadgeElement(scriptType);

    const info = document.createElement('div');
    info.className = 'script-info scriptblox-card-info';

    const heading = document.createElement('h3');
    heading.className = 'script-title';
    heading.textContent = title;

    const gameLabel = document.createElement('p');
    gameLabel.className = 'scriptblox-game-label';
    gameLabel.textContent = gameName ? gameName : 'Unknown Game';

    const actions = document.createElement('div');
    actions.className = 'scriptblox-card-actions';

    const executeButton = document.createElement('button');
    executeButton.type = 'button';
    executeButton.className = 'script-execute-btn';
    executeButton.textContent = 'Execute';
    executeButton.disabled = Boolean(killSwitchEnabled);
    if (killSwitchEnabled) {
        executeButton.title = 'Kill Switch is enabled';
    }
    executeButton.addEventListener('click', async () => {
        if (killSwitchEnabled) {
            showNotification('Kill Switch is enabled. Execution is disabled.', 'error');
            return;
        }
        await withBusyButton(executeButton, 'Executing...', async () => {
            try {
                const scriptContent = await resolveScriptbloxScriptContent(script);
                const result = await window.electronAPI.executeScript(scriptContent);
                if (!result?.success) {
                    throw new Error(result?.message || 'Execution failed.');
                }
                showNotification('Script executed.', 'info');
            } catch (error) {
                showNotification(`Execution failed: ${error.message}`, 'error');
            }
        });
    });

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'script-copy-btn';
    copyButton.textContent = 'Copy Script';
    copyButton.addEventListener('click', async () => {
        await withBusyButton(copyButton, 'Copying...', async () => {
            try {
                const scriptContent = await resolveScriptbloxScriptContent(script);
                await copyTextToClipboard(scriptContent);
                showNotification('Script copied to clipboard.', 'info');
            } catch (error) {
                showNotification(`Copy failed: ${error.message}`, 'error');
            }
        });
    });

    actions.appendChild(executeButton);
    actions.appendChild(copyButton);

    info.appendChild(heading);
    info.appendChild(gameLabel);
    info.appendChild(actions);

    card.appendChild(thumbnail);
    if (badge) {
        card.appendChild(badge);
    }
    card.appendChild(info);

    return card;
}

function renderScriptbloxCards(scripts) {
    if (!scriptbloxCardsContainer) return;

    scriptbloxCardsContainer.innerHTML = '';

    if (!Array.isArray(scripts) || scripts.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.className = 'scriptblox-empty-state';
        emptyState.textContent = scriptbloxQuery
            ? 'No scripts found for your search.'
            : 'No trending scripts available right now.';
        scriptbloxCardsContainer.appendChild(emptyState);
        return;
    }

    scripts.forEach((script) => {
        const card = createScriptbloxCard(script);
        scriptbloxCardsContainer.appendChild(card);
    });

    if (typeof window.updateKillSwitchUI === 'function') {
        window.updateKillSwitchUI();
    }
}

async function fetchScriptbloxWithRetries({ query, page, requestToken }) {
    let lastError = 'Failed to connect to ScriptBlox.';

    for (let attempt = 1; attempt <= SCRIPTBLOX_RETRY_ATTEMPTS; attempt += 1) {
        if (requestToken !== scriptbloxLoadToken) {
            return { cancelled: true };
        }

        let result;
        if (query) {
            result = await window.electronAPI.scriptbloxSearch({
                query,
                page,
                max: SCRIPTBLOX_MAX_RESULTS
            });
        } else {
            result = await window.electronAPI.scriptbloxTrending();
        }

        if (result?.success) {
            return { cancelled: false, payload: result.result || {} };
        }

        if (result?.error) {
            lastError = result.error;
        }

        if (attempt < SCRIPTBLOX_RETRY_ATTEMPTS) {
            await sleep(SCRIPTBLOX_RETRY_DELAY_MS);
        }
    }

    throw new Error(lastError || 'Failed to connect to ScriptBlox.');
}

async function loadScriptbloxScripts({ query = scriptbloxQuery, page = 1 } = {}) {
    if (currentScriptsSource !== 'scriptblox') {
        return;
    }

    if (!window.electronAPI?.scriptbloxTrending || !window.electronAPI?.scriptbloxSearch) {
        setScriptbloxStatus('ScriptBlox is unavailable in this build.', { isError: true });
        return;
    }

    const normalizedQuery = String(query || '').trim();
    const normalizedPage = Math.max(1, Math.floor(Number(page) || 1));

    scriptbloxQuery = normalizedQuery;
    scriptbloxPage = normalizedPage;
    if (scriptbloxSearchInput && scriptbloxSearchInput.value !== normalizedQuery) {
        scriptbloxSearchInput.value = normalizedQuery;
    }

    updateScriptbloxHeaderTitle();
    setScriptbloxLoading(true);
    setScriptbloxStatus(
        normalizedQuery ? 'Searching ScriptBlox...' : 'Loading ScriptBlox trending scripts...'
    );

    const requestToken = ++scriptbloxLoadToken;

    try {
        const result = await fetchScriptbloxWithRetries({
            query: normalizedQuery,
            page: normalizedPage,
            requestToken
        });

        if (result.cancelled || requestToken !== scriptbloxLoadToken) {
            return;
        }

        const payload = result.payload || {};
        const scripts = Array.isArray(payload.scripts) ? payload.scripts : [];

        if (normalizedQuery) {
            scriptbloxTotalPages = Math.max(1, Number(payload.totalPages) || 1);
            scriptbloxPage = Math.min(Math.max(1, Number(payload.page) || normalizedPage), scriptbloxTotalPages);
        } else {
            scriptbloxTotalPages = 1;
            scriptbloxPage = 1;
        }

        renderScriptbloxCards(scripts);
        updateScriptbloxPagination();

        if (scripts.length === 0) {
            setScriptbloxStatus(normalizedQuery ? 'No scripts found.' : 'No trending scripts available.');
        } else {
            setScriptbloxStatus('');
        }
    } catch (error) {
        if (requestToken !== scriptbloxLoadToken) {
            return;
        }

        scriptbloxTotalPages = 1;
        scriptbloxPage = 1;
        renderScriptbloxCards([]);
        updateScriptbloxPagination();
        setScriptbloxStatus('Failed to connect to ScriptBlox.', { isError: true });
    } finally {
        if (requestToken === scriptbloxLoadToken) {
            setScriptbloxLoading(false);
        }
    }
}

function initializeScriptbloxControls() {
    if (scriptbloxControlsInitialized) {
        return;
    }

    if (!scriptbloxSearchInput || !scriptbloxPrevBtn || !scriptbloxNextBtn) {
        return;
    }

    scriptbloxSearchInput.addEventListener('input', () => {
        if (scriptbloxSearchDebounce) {
            clearTimeout(scriptbloxSearchDebounce);
        }

        scriptbloxSearchDebounce = setTimeout(() => {
            loadScriptbloxScripts({
                query: scriptbloxSearchInput.value.trim(),
                page: 1
            });
        }, 280);
    });

    scriptbloxSearchInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;

        event.preventDefault();
        if (scriptbloxSearchDebounce) {
            clearTimeout(scriptbloxSearchDebounce);
        }

        loadScriptbloxScripts({
            query: scriptbloxSearchInput.value.trim(),
            page: 1
        });
    });

    scriptbloxPrevBtn.addEventListener('click', () => {
        if (scriptbloxIsLoading || scriptbloxPage <= 1) return;
        loadScriptbloxScripts({
            query: scriptbloxQuery,
            page: scriptbloxPage - 1
        });
    });

    scriptbloxNextBtn.addEventListener('click', () => {
        if (scriptbloxIsLoading || scriptbloxPage >= scriptbloxTotalPages) return;
        loadScriptbloxScripts({
            query: scriptbloxQuery,
            page: scriptbloxPage + 1
        });
    });

    scriptbloxControlsInitialized = true;
}

function setScriptsSource(source, { persist = true } = {}) {
    currentScriptsSource = normalizeScriptsSource(source);
    applyScriptsSourceUI();

    if (persist && window.safeStorage) {
        window.safeStorage.setItem('zyronScriptsSource', currentScriptsSource);
    }

    if (currentScriptsSource === 'zexon') {
        loadScriptCards();
    } else {
        initializeScriptbloxControls();
        loadScriptbloxScripts({
            query: scriptbloxSearchInput ? scriptbloxSearchInput.value.trim() : scriptbloxQuery,
            page: 1
        });
    }
}

async function initializeScriptsSourceNavigation() {
    if (window.safeStorageReady && typeof window.safeStorageReady.then === 'function') {
        try {
            await window.safeStorageReady;
        } catch (error) {
            console.error('Failed to initialize script source preference:', error);
        }
    }

    initializeScriptbloxControls();

    const storedSource = window.safeStorage?.getItem('zyronScriptsSource');
    setScriptsSource(storedSource, { persist: false });

    if (scriptsSourceZexonBtn) {
        scriptsSourceZexonBtn.addEventListener('click', () => {
            setScriptsSource('zexon', { persist: true });
        });
    }

    if (scriptsSourceScriptbloxBtn) {
        scriptsSourceScriptbloxBtn.addEventListener('click', () => {
            setScriptsSource('scriptblox', { persist: true });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initializeScriptsSourceNavigation();
    }, 120);
});

function filterScriptCards() {
    const scriptHubSearch = document.getElementById('script-hub-search');
    if (!scriptHubSearch) return;

    const query = scriptHubSearch.value.toLowerCase();
    const cards = document.querySelectorAll('#script-cards-container .script-card');

    cards.forEach((card) => {
        const titleElement = card.querySelector('.script-title');
        const descriptionElement = card.querySelector('.script-description');
        const title = titleElement ? titleElement.textContent.toLowerCase() : '';
        const description = descriptionElement ? descriptionElement.textContent.toLowerCase() : '';
        const scriptType = card.dataset.scriptType;

        const matchesSearch = !query || title.includes(query) || description.includes(query);

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

        card.style.display = matchesSearch && matchesFilter ? '' : 'none';
    });
}

async function loadScriptCards() {
    if (currentScriptsSource !== 'zexon') {
        return;
    }

    const container = document.getElementById('script-cards-container');
    if (!container) return;

    try {
        const scripts = await window.electronAPI.getScripts();
        container.innerHTML = '';

        if (scripts && scripts.length > 0) {
            scripts.forEach((script) => {
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

    if (typeof window.updateKillSwitchUI === 'function') {
        window.updateKillSwitchUI();
    }
}

function createScriptCard(script) {
    const card = document.createElement('div');
    card.className = 'script-card';
    card.dataset.scriptType = script.type || 'free';

    const thumbnail = script.thumbnail
        ? `<img src="file://${script.thumbnail}" alt="${script.name}" onerror="this.parentElement.innerHTML='${script.name}'">`
        : script.name;

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
            <button class="script-execute-btn" ${killSwitchEnabled ? 'disabled title="Kill Switch is enabled"' : ''} onclick="executeHubScript('${script.path}', '${script.name}', '${script.type}', '${script.id || ''}')">Execute</button>
        </div>
    `;

    return card;
}

function getTypeBadge(type) {
    const badges = {
        free: '<div class="script-type-badge free">Free</div>',
        'key-system': '<div class="script-type-badge key-system">Key System</div>',
        paid: '<div class="script-type-badge paid">Paid</div>',
        'paid-key-system': '<div class="script-type-badge paid-key-system">Paid + Key</div>',
        'paid-free': '<div class="script-type-badge paid-free">Free/Paid</div>'
    };
    return badges[type] || badges.free;
}

window.executeHubScript = async function(scriptPath, scriptName, scriptType, scriptId = '') {
    if (killSwitchEnabled) {
        showNotification('Kill Switch is enabled. Execution is disabled.', 'error');
        return;
    }

    try {
        let savedKey = '';

        try {
            const settingsResult = await window.electronAPI.loadScriptSettings({
                scriptId,
                scriptName
            });
            if (settingsResult.success && settingsResult.settings) {
                savedKey = settingsResult.settings.savedKey || '';
            }
        } catch (error) {
            console.error('Failed to load script settings:', error);
        }

        const result = await window.electronAPI.executeHubScript(scriptPath, savedKey);
        if (!result.success) {
            showNotification(`Execution failed: ${result.message}`, 'error');
        }
    } catch (error) {
        showNotification(`Execution error: ${error.message}`, 'error');
    }
};

window.setScriptsSource = setScriptsSource;
window.getCurrentScriptsSource = () => currentScriptsSource;
window.loadScriptbloxScripts = loadScriptbloxScripts;
