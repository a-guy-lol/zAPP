function showNotification(message, type = 'info') {
    if (!notificationsEnabled) return;
    
    const container = document.getElementById('notification-container');
    if (!container) return;

    const normalizedType = type === 'error' ? 'error' : 'info';
    const iconSrcByType = {
        info: 'assets/images/notification.png',
        error: 'assets/images/notification.png'
    };
    const titleByType = {
        info: 'Notice',
        error: 'Error'
    };
    const notificationTitle = titleByType[normalizedType];
    const notificationMessage = String(message);

    let historyId = null;
    if (typeof window.recordNotification === 'function') {
        historyId = window.recordNotification({
            message: notificationMessage,
            type: normalizedType,
            title: notificationTitle
        });
    }

    const notification = document.createElement('div');
    notification.className = `notification ${normalizedType}`;

    const icon = document.createElement('img');
    icon.className = 'notification-icon';
    icon.src = iconSrcByType[normalizedType];
    icon.alt = '';

    const content = document.createElement('div');
    content.className = 'notification-content';

    const title = document.createElement('div');
    title.className = 'notification-title';
    title.textContent = notificationTitle;

    const body = document.createElement('div');
    body.className = 'notification-message';
    body.textContent = notificationMessage;

    content.appendChild(title);
    content.appendChild(body);
    notification.appendChild(icon);
    notification.appendChild(content);
    
    container.appendChild(notification);

    let dismissed = false;
    let timeoutId = null;

    const removeNow = () => {
        if (notification.parentNode) {
            notification.remove();
        }
    };

    const dismiss = ({ clicked = false, instant = false } = {}) => {
        if (dismissed) return;
        dismissed = true;
        if (timeoutId) clearTimeout(timeoutId);

        if (clicked && historyId && typeof window.markNotificationReadById === 'function') {
            window.markNotificationReadById(historyId);
        }

        if (instant) {
            removeNow();
            return;
        }

        notification.classList.remove('show');
        notification.addEventListener('transitionend', removeNow, { once: true });
        setTimeout(removeNow, 240);
    };

    notification.addEventListener('click', () => dismiss({ clicked: true, instant: false }));

    setTimeout(() => {
        if (dismissed) return;
        notification.classList.add('show');
    }, 10);

    timeoutId = setTimeout(() => dismiss({ clicked: false }), 5000);
}

function setupStatusPopups() {
    // Add click listeners to connection items
    const robloxConnectionItem = document.querySelector('#roblox-status-indicator').closest('.connection-item');
    
    if (robloxConnectionItem) {
        robloxConnectionItem.addEventListener('click', () => showRobloxStatusPopup());
    }
}

async function showRobloxStatusPopup() {
    const isConnected = await window.electronAPI.checkConnection();
    const statusClass = isConnected ? 'connected' : 'disconnected';
    const statusColor = isConnected ? 'var(--green-status)' : 'var(--red-status)';
    const statusText = isConnected ? 'Connected' : 'Disconnected';
    const executorLabel = selectedExecutor === 'macsploit' ? 'MacSploit' : 'Hydrogen';
    
    let message;
    if (isConnected) {
        message = `Zyron is connected to Roblox through ${executorLabel}. Your scripts are ready to run.`;
    } else {
        message = `${executorLabel} is not connected right now. Open Roblox and make sure your selected executor is running.`;
    }

    showStatusPopup('Roblox', statusText, statusClass, statusColor, message, 'robloxIcon.png');
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
