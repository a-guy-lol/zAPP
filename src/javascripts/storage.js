let memoryStorage = {};
let cachedPreferences = {};
let backendAvailable = false;
let writeQueue = Promise.resolve();

function getLegacyLocalStorage() {
    try {
        const testKey = '__zyron_storage_test__';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
        return localStorage;
    } catch (error) {
        return null;
    }
}

function normalizePreferenceMap(rawMap) {
    if (!rawMap || typeof rawMap !== 'object') {
        return {};
    }
    const normalized = {};
    Object.entries(rawMap).forEach(([key, value]) => {
        if (typeof key !== 'string') return;
        if (!key.trim()) return;
        if (value === null || typeof value === 'undefined') return;
        normalized[key] = String(value);
    });
    return normalized;
}

function collectLegacyZyronKeys(storageBackend) {
    if (!storageBackend) return {};
    const result = {};
    for (let i = 0; i < storageBackend.length; i += 1) {
        const key = storageBackend.key(i);
        if (!key || !key.startsWith('zyron')) continue;
        const value = storageBackend.getItem(key);
        if (value === null || typeof value === 'undefined') continue;
        result[key] = String(value);
    }
    return result;
}

function clearLegacyKeys(storageBackend, keys) {
    if (!storageBackend || !Array.isArray(keys) || keys.length === 0) return;
    keys.forEach((key) => {
        try {
            storageBackend.removeItem(key);
        } catch (error) {
            console.warn(`Failed to clear legacy localStorage key ${key}:`, error);
        }
    });
}

async function initializeSafeStorage() {
    const legacyStorage = getLegacyLocalStorage();
    const legacyPreferences = normalizePreferenceMap(collectLegacyZyronKeys(legacyStorage));

    if (!window.electronAPI || typeof window.electronAPI.preferencesGetAll !== 'function') {
        cachedPreferences = { ...legacyPreferences };
        memoryStorage = { ...cachedPreferences };
        return;
    }

    try {
        const result = await window.electronAPI.preferencesGetAll();
        const backendPreferences = result?.success
            ? normalizePreferenceMap(result.preferences)
            : {};

        // Backend values win on key conflicts; missing keys are hydrated from legacy localStorage.
        const mergedPreferences = {
            ...legacyPreferences,
            ...backendPreferences
        };

        const backendCount = Object.keys(backendPreferences).length;
        const mergedCount = Object.keys(mergedPreferences).length;
        if (mergedCount > backendCount && typeof window.electronAPI.preferencesSetMany === 'function') {
            await window.electronAPI.preferencesSetMany(mergedPreferences);
        }

        clearLegacyKeys(legacyStorage, Object.keys(legacyPreferences));

        cachedPreferences = mergedPreferences;
        backendAvailable = true;
    } catch (error) {
        console.error('Failed to initialize backend preferences, using memory fallback:', error);
        cachedPreferences = { ...legacyPreferences };
        memoryStorage = { ...cachedPreferences };
    }
}

const safeStorageReady = initializeSafeStorage();

function enqueueBackendWrite(task) {
    writeQueue = writeQueue
        .then(async () => {
            await safeStorageReady;
            if (!backendAvailable) return;
            await task();
        })
        .catch((error) => {
            console.error('Failed writing preference update:', error);
        });
    return writeQueue;
}

const safeStorage = {
    getItem: function(key) {
        if (!Object.prototype.hasOwnProperty.call(cachedPreferences, key)) {
            return null;
        }
        return cachedPreferences[key];
    },

    setItem: function(key, value) {
        if (typeof key !== 'string' || !key.trim()) return;
        const normalizedValue = String(value);
        cachedPreferences[key] = normalizedValue;
        memoryStorage[key] = normalizedValue;
        enqueueBackendWrite(() => window.electronAPI.preferencesSet(key, normalizedValue));
    },

    removeItem: function(key) {
        if (typeof key !== 'string' || !key.trim()) return;
        delete cachedPreferences[key];
        delete memoryStorage[key];
        enqueueBackendWrite(() => window.electronAPI.preferencesRemove(key));
    },

    clear: function() {
        cachedPreferences = {};
        memoryStorage = {};
        enqueueBackendWrite(() => window.electronAPI.preferencesClear());
    },

    flush: function() {
        return writeQueue;
    }
};

window.safeStorage = safeStorage;
window.safeStorageReady = safeStorageReady;
window.safeStorageFlush = () => safeStorage.flush();
