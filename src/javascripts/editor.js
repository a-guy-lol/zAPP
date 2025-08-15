function createEditorElement(id, content) {
    const editorContainer = document.createElement('div');
    editorContainer.id = `editor-${id}`;
    editorContainer.className = 'editor-container hidden';
    editorArea.appendChild(editorContainer);
    const editor = ace.edit(editorContainer);
    editor.session.setMode("ace/mode/lua");
    editor.setTheme("ace/theme/twilight");
    editor.session.setValue(content || "");
    editor.setOptions({
        showPrintMargin: false,
        fontSize: "14px",
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: true,
        enableSnippets: true
    });
    const LuaMode = ace.require("ace/mode/lua").Mode;
    const LuaHighlightRules = ace.require("ace/mode/lua_highlight_rules").LuaHighlightRules;
    const TextHighlightRules = ace.require("ace/mode/text_highlight_rules").TextHighlightRules;
    const session = editor.session;
    const mode = session.getMode();
    if (mode instanceof LuaMode) {
        const rules = mode.$highlightRules || new LuaHighlightRules();
        if (rules.$keywordList) {
            const removeIdx = rules.$keywordList.indexOf("collectgarbage");
            if (removeIdx > -1) rules.$keywordList.splice(removeIdx, 1);
            if (!rules.$keywordList.includes("create")) rules.$keywordList.push("create");
            rules.keywordMapper = TextHighlightRules.prototype.createKeywordMapper({
                "keyword": rules.$keywordList.join("|")
            }, "identifier");
            session.bgTokenizer.start(0);
        }
    }
    editor.session.on('change', () => {
        const tab = TABS_DATA.find(t => t.id === id);
        if (tab) {
            tab.content = editor.session.getValue();
            debouncedAutoSave();
        }
    });
    editors[id] = editor;
}
async function executeScript() {
    const scriptContent = editors[activeTabId]?.session.getValue();
    if (!scriptContent) return;
    executeBtn.textContent = 'Executing...';
    executeBtn.disabled = true;
    try {
        const result = await window.electronAPI.executeScript(scriptContent);
        if (result.success) {
            showNotification('Script executed successfully!');
        } else {
            showNotification(`Execution failed: ${result.message}`, 'error');
        }
    } catch(e) {
        showNotification(`Execution error: ${e.message}`, 'error');
    }
    finally {
        executeBtn.textContent = 'Execute';
        checkConnection();
    }
}
