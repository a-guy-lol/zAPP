// Safe localStorage wrapper with in-memory fallback.
let memoryStorage = {};

function getStorageBackend() {
    try {
        const testKey = '__zyron_storage_test__';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
        return localStorage;
    } catch (error) {
        console.warn('localStorage unavailable, using in-memory storage:', error);
        return null;
    }
}

const storageBackend = getStorageBackend();

const safeStorage = {
    getItem: function(key) {
        if (storageBackend) {
            return storageBackend.getItem(key);
        }
        return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null;
    },

    setItem: function(key, value) {
        if (storageBackend) {
            storageBackend.setItem(key, value);
            return;
        }
        memoryStorage[key] = String(value);
    },

    removeItem: function(key) {
        if (storageBackend) {
            storageBackend.removeItem(key);
            return;
        }
        delete memoryStorage[key];
    },

    clear: function() {
        if (storageBackend) {
            storageBackend.clear();
            return;
        }
        memoryStorage = {};
    }
};

// Export for use in other files
window.safeStorage = safeStorage;
