// Storage utility that respects development mode
// In development mode, localStorage operations are no-ops

let isDev = false;
let devStorage = {};

// Initialize development mode check
(async function initDevMode() {
    try {
        isDev = await window.electronAPI.isDevelopment();
        console.log(`Running in ${isDev ? 'development' : 'production'} mode`);
        if (isDev) {
            console.log('Development mode: localStorage operations will be disabled');
        }
    } catch (error) {
        console.error('Failed to check development mode:', error);
    }
})();

// Safe localStorage wrapper
const safeStorage = {
    getItem: function(key) {
        if (isDev) {
            return devStorage[key] || null;
        }
        return localStorage.getItem(key);
    },
    
    setItem: function(key, value) {
        if (isDev) {
            devStorage[key] = value;
            return;
        }
        localStorage.setItem(key, value);
    },
    
    removeItem: function(key) {
        if (isDev) {
            delete devStorage[key];
            return;
        }
        localStorage.removeItem(key);
    },
    
    clear: function() {
        if (isDev) {
            devStorage = {};
            return;
        }
        localStorage.clear();
    }
};

// Export for use in other files
window.safeStorage = safeStorage;
