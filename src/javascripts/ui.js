function switchMainView(viewName) {
    scriptsPane.classList.add('hidden');
    editorPane.classList.add('hidden');
    settingsPane.classList.add('hidden');
    aboutPane.classList.add('hidden');
    
    navScriptsBtn.classList.remove('active');
    navEditorBtn.classList.remove('active');
    navSettingsBtn.classList.remove('active');
    navAboutBtn.classList.remove('active');

    if (viewName === 'scripts') {
        scriptsPane.classList.remove('hidden');
        navScriptsBtn.classList.add('active');
        loadScriptCards();
    } else if (viewName === 'editor') {
        editorPane.classList.remove('hidden');
        navEditorBtn.classList.add('active');
        Object.values(editors).forEach(editor => editor.resize());
    } else if (viewName === 'settings') {
        settingsPane.classList.remove('hidden');
        navSettingsBtn.classList.add('active');
    } else if (viewName === 'about') {
        aboutPane.classList.remove('hidden');
        navAboutBtn.classList.add('active');
    }
}

function filterTabs() {
    const query = scriptSearchBox.value.toLowerCase();
    const tabs = scriptTabBar.querySelectorAll('.script-tab');
    tabs.forEach(tab => {
        const tabName = tab.querySelector('.tab-name').textContent.toLowerCase();
        if (tabName.includes(query)) {
            tab.style.display = '';
        } else {
            tab.style.display = 'none';
        }
    });
}

document.body.addEventListener('click', function(event) {
    // Prevent click effect when interacting with UI elements
    if (document.body.classList.contains('performance-mode')) return;
    if (event.target.closest('button, a, input, .script-tab, .context-menu-item')) {
        return;
    }
    const particle = document.createElement('div');
    particle.classList.add('click-effect');
    const size = Math.random() * 4 + 2;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${event.clientX - size / 2}px`;
    particle.style.top = `${event.clientY - size / 2}px`;
    document.body.appendChild(particle);
    setTimeout(() => { particle.remove(); }, 600);
});
