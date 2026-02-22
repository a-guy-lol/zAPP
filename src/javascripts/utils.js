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
