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

function setupStatusPopups() {
    // Add click listeners to connection items
    const robloxConnectionItem = document.querySelector('#roblox-status-indicator').closest('.connection-item');
    const zexiumConnectionItem = document.querySelector('#zexium-status-indicator').closest('.connection-item');
    
    if (robloxConnectionItem) {
        robloxConnectionItem.addEventListener('click', () => showRobloxStatusPopup());
    }
    
    if (zexiumConnectionItem) {
        zexiumConnectionItem.addEventListener('click', () => showZexiumStatusPopup());
    }
}

async function showRobloxStatusPopup() {
    const isConnected = await window.electronAPI.checkConnection();
    const statusClass = isConnected ? 'connected' : 'disconnected';
    const statusColor = isConnected ? 'var(--green-status)' : 'var(--red-status)';
    const statusText = isConnected ? 'Connected' : 'Disconnected';
    
    let message;
    if (isConnected) {
        message = "Zyron is fully connected to Roblox/Hydrogen with no issues! Your scripts are ready to execute.";
    } else {
        message = "It seems like Roblox is not connected. Either Roblox is not open or Hydrogen (the required executor) is not installed.";
    }

    showStatusPopup('Roblox', statusText, statusClass, statusColor, message, 'robloxIcon.png');
}

async function showZexiumStatusPopup() {
    const zexiumStatus = await window.electronAPI.getZexiumAPIStatus();
    let statusClass, statusColor, statusText, message;
    
    if (!zexiumStatus.enabled) {
        statusClass = 'disabled';
        statusColor = '#666';
        statusText = 'Disabled';
        message = "Looks like Zexium API is disabled. To unlock enhanced features and Execute on Join functionality, enable it in the settings menu above.";
    } else if (zexiumStatus.clientConnected) {
        statusClass = 'connected';
        statusColor = 'var(--green-status)';
        statusText = 'Connected';
        message = "Zexium API is successfully connected to Roblox! Execute on Join functionality is active and ready to enhance your experience.";
    } else if (zexiumStatus.serverRunning) {
        statusClass = 'pending';
        statusColor = '#fbbf24';
        statusText = 'Pending';
        message = "Zexium API is waiting for Roblox to respond. If this status persists, try re-entering a game or restarting Roblox to establish the connection.";
    } else {
        statusClass = 'disconnected';
        statusColor = 'var(--red-status)';
        statusText = 'Disconnected';
        message = "Zexium API server is not running. This might be temporary - the system will automatically try to reconnect.";
    }

    showStatusPopup('Zexium API', statusText, statusClass, statusColor, message, 'zexiumIcon.png');
}

function showStatusPopup(title, statusText, statusClass, statusColor, message, iconName) {
    // Remove any existing popup
    const existingPopup = document.querySelector('.status-popup-overlay');
    if (existingPopup) existingPopup.remove();

    // Create popup overlay
    const overlay = document.createElement('div');
    overlay.className = 'status-popup-overlay';
    
    // Create popup content
    const popup = document.createElement('div');
    popup.className = 'status-popup';
    
    popup.innerHTML = `
        <div class="status-popup-header">
            <img src="assets/images/${iconName}" alt="${title}" class="status-popup-icon">
            <h3 class="status-popup-title">${title}</h3>
            <div class="status-popup-indicator ${statusClass}" style="background-color: ${statusColor}; box-shadow: 0 0 6px ${statusColor};"></div>
        </div>
        <p class="status-popup-message">${message}</p>
    `;

    // Add popup to overlay
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Add click to dismiss functionality
    overlay.addEventListener('click', () => overlay.remove());

    // Auto-update if status changes
    const updateInterval = setInterval(async () => {
        if (!document.body.contains(overlay)) {
            clearInterval(updateInterval);
            return;
        }

        let newStatusClass, newStatusColor, newStatusText;
        
        if (title === 'Roblox') {
            const isConnected = await window.electronAPI.checkConnection();
            newStatusClass = isConnected ? 'connected' : 'disconnected';
            newStatusColor = isConnected ? 'var(--green-status)' : 'var(--red-status)';
            newStatusText = isConnected ? 'Connected' : 'Disconnected';
        } else if (title === 'Zexium API') {
            const zexiumStatus = await window.electronAPI.getZexiumAPIStatus();
            if (!zexiumStatus.enabled) {
                newStatusClass = 'disabled';
                newStatusColor = '#666';
                newStatusText = 'Disabled';
            } else if (zexiumStatus.clientConnected) {
                newStatusClass = 'connected';
                newStatusColor = 'var(--green-status)';
                newStatusText = 'Connected';
            } else if (zexiumStatus.serverRunning) {
                newStatusClass = 'pending';
                newStatusColor = '#fbbf24';
                newStatusText = 'Pending';
            } else {
                newStatusClass = 'disconnected';
                newStatusColor = 'var(--red-status)';
                newStatusText = 'Disconnected';
            }
        }

        // Update indicator if status changed
        if (newStatusClass !== statusClass) {
            const indicator = popup.querySelector('.status-popup-indicator');
            indicator.className = `status-popup-indicator ${newStatusClass}`;
            indicator.style.backgroundColor = newStatusColor;
            indicator.style.boxShadow = `0 0 6px ${newStatusColor}`;
            statusClass = newStatusClass;
            statusColor = newStatusColor;
            statusText = newStatusText;
        }
    }, 1000);
}
