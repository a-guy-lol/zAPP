const LUA_KEYWORDS = [
    'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
    'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then',
    'true', 'until', 'while'
];

const LUA_GLOBALS = [
    '_G', '_VERSION', 'assert', 'collectgarbage', 'error', 'getmetatable', 'ipairs',
    'next', 'pairs', 'pcall', 'print', 'rawequal', 'rawget', 'rawlen', 'rawset',
    'select', 'setmetatable', 'tonumber', 'tostring', 'type', 'warn', 'xpcall',
    'coroutine.create', 'coroutine.resume', 'coroutine.running', 'coroutine.status',
    'coroutine.wrap', 'coroutine.yield',
    'math.abs', 'math.acos', 'math.asin', 'math.atan', 'math.ceil', 'math.clamp',
    'math.cos', 'math.deg', 'math.exp', 'math.floor', 'math.fmod', 'math.huge',
    'math.log', 'math.max', 'math.min', 'math.pi', 'math.rad', 'math.random',
    'math.round', 'math.sign', 'math.sin', 'math.sqrt', 'math.tan',
    'string.byte', 'string.char', 'string.find', 'string.format', 'string.gmatch',
    'string.gsub', 'string.len', 'string.lower', 'string.match', 'string.rep',
    'string.reverse', 'string.split', 'string.sub', 'string.upper',
    'table.clear', 'table.clone', 'table.concat', 'table.find', 'table.freeze',
    'table.insert', 'table.maxn', 'table.move', 'table.pack', 'table.remove',
    'table.sort', 'table.unpack',
    'utf8.char', 'utf8.codepoint', 'utf8.codes', 'utf8.len', 'utf8.offset'
];

const ROBLOX_CLIENT_APIS = [
    'game', 'workspace', 'script', 'shared', 'Enum', 'Instance.new', 'typeof',
    'task.wait', 'task.spawn', 'task.defer', 'task.delay',
    'Players', 'Players.LocalPlayer', 'Players:GetPlayers', 'Players.PlayerRemoving',
    'LocalPlayer.Character', 'LocalPlayer.CharacterAdded', 'LocalPlayer:GetMouse',
    'RunService', 'RunService.RenderStepped', 'RunService.Heartbeat', 'RunService.Stepped',
    'RunService:BindToRenderStep', 'RunService:UnbindFromRenderStep',
    'UserInputService', 'UserInputService.InputBegan', 'UserInputService.InputEnded',
    'UserInputService:GetMouseLocation', 'UserInputService:IsKeyDown',
    'ContextActionService', 'ContextActionService:BindAction', 'ContextActionService:UnbindAction',
    'TweenService', 'TweenService:Create',
    'GuiService', 'GuiService:GetGuiInset',
    'StarterGui', 'StarterGui:SetCore', 'StarterGui:SetCoreGuiEnabled',
    'MarketplaceService', 'TeleportService',
    'ReplicatedStorage', 'ReplicatedFirst', 'Lighting', 'CurrentCamera', 'workspace.CurrentCamera',
    'RemoteEvent:FireServer', 'RemoteFunction:InvokeServer', 'BindableEvent:Fire',
    'CFrame.new', 'CFrame.Angles', 'CFrame.fromMatrix', 'CFrame.lookAt',
    'Vector2.new', 'Vector3.new', 'UDim.new', 'UDim2.new', 'Rect.new', 'Region3.new',
    'Color3.new', 'Color3.fromRGB', 'Color3.fromHSV', 'ColorSequence.new',
    'NumberSequence.new', 'BrickColor.new', 'Ray.new', 'RaycastParams.new', 'OverlapParams.new',
    'Axes.new', 'Faces.new',
    'workspace:Raycast', 'workspace:GetPartBoundsInBox', 'workspace:GetPartBoundsInRadius',
    'workspace:FindPartOnRay', 'workspace:FindPartsInRegion3',
    ':WaitForChild', ':FindFirstChild', ':FindFirstChildOfClass', ':FindFirstChildWhichIsA',
    ':GetChildren', ':GetDescendants', ':GetAttribute', ':SetAttribute', ':IsA',
    ':Clone', ':Destroy', ':Connect', ':Disconnect'
];

// Parsed from /Users/guy/Documents/sUNC Documentation.txt
const SUNC_APIS = [
    'appendfile', 'base64decode', 'base64encode', 'checkcaller', 'cleardrawcache',
    'clonefunction', 'cloneref', 'compareinstances', 'debug', 'debug.getconstant',
    'debug.getconstants', 'debug.getproto', 'debug.getprotos', 'debug.getstack',
    'debug.getupvalue', 'debug.getupvalues', 'debug.setconstant', 'debug.setstack',
    'debug.setupvalue', 'delfile', 'delfolder', 'Drawing', 'filtergc',
    'fireclickdetector', 'fireproximityprompt', 'firesignal', 'firetouchinterest',
    'getcallbackvalue', 'getcallingscript', 'getconnections', 'getcustomasset',
    'getfunctionhash', 'getgc', 'getgenv', 'gethiddenproperty', 'gethui',
    'getinstances', 'getloadedmodules', 'getnamecallmethod', 'getnilinstances',
    'getrawmetatable', 'getreg', 'getrenderproperty', 'getrenv', 'getrunningscripts',
    'getscriptbytecode', 'getscriptclosure', 'getscripthash', 'getscripts', 'getsenv',
    'getthreadidentity', 'hookfunction', 'hookmetamethod', 'identifyexecutor',
    'iscclosure', 'isexecutorclosure', 'isfile', 'isfolder', 'islclosure', 'isreadonly',
    'isrenderobj', 'isscriptable', 'listfiles', 'loadfile', 'loadstring',
    'lz4compress', 'lz4decompress', 'makefolder', 'newcclosure', 'readfile',
    'replicatesignal', 'request', 'restorefunction', 'sethiddenproperty',
    'setrawmetatable', 'setreadonly', 'setrenderproperty', 'setscriptable',
    'setthreadidentity', 'WebSocket', 'writefile'
];

const NON_CALLABLE_COMPLETIONS = new Set([
    'game', 'workspace', 'script', 'shared', 'Enum', 'Players', 'RunService',
    'UserInputService', 'ContextActionService', 'TweenService', 'GuiService',
    'StarterGui', 'MarketplaceService', 'TeleportService', 'ReplicatedStorage',
    'ReplicatedFirst', 'Lighting', 'CurrentCamera', 'workspace.CurrentCamera',
    'Players.LocalPlayer', 'LocalPlayer.Character', 'LocalPlayer.CharacterAdded',
    'debug', 'Drawing', 'WebSocket',
    ':WaitForChild', ':FindFirstChild', ':FindFirstChildOfClass', ':FindFirstChildWhichIsA',
    ':GetChildren', ':GetDescendants', ':GetAttribute', ':SetAttribute', ':IsA',
    ':Clone', ':Destroy', ':Connect', ':Disconnect'
]);

const SNIPPET_COMPLETIONS = [
    {
        trigger: 'fun',
        label: 'fun -> function() ... end',
        snippet: 'function($0)\n\t\nend'
    },
    {
        trigger: 'lfun',
        label: 'lfun -> local function name() ... end',
        snippet: 'local function $0()\n\t\nend'
    },
    {
        trigger: 'fori',
        label: 'fori -> numeric for loop',
        snippet: 'for i = 1, $0 do\n\t\nend'
    },
    {
        trigger: 'forp',
        label: 'forp -> pairs loop',
        snippet: 'for key, value in pairs($0) do\n\t\nend'
    },
    {
        trigger: 'forip',
        label: 'forip -> ipairs loop',
        snippet: 'for index, value in ipairs($0) do\n\t\nend'
    },
    {
        trigger: 'ifn',
        label: 'ifn -> if ... then ... end',
        snippet: 'if $0 then\n\t\nend'
    },
    {
        trigger: 'ifelse',
        label: 'ifelse -> if ... then ... else ... end',
        snippet: 'if $0 then\n\t\nelse\n\t\nend'
    },
    {
        trigger: 'taskw',
        label: 'taskw -> task.wait()',
        snippet: 'task.wait($0)'
    }
];

function isCallableName(name) {
    if (NON_CALLABLE_COMPLETIONS.has(name)) return false;
    if (name.startsWith(':')) return false;
    return true;
}

function makeSimpleCompletion(text, extraTerms = []) {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return null;
    return {
        text: normalizedText,
        displayText: normalizedText,
        className: 'cm-hint-symbol',
        terms: [normalizedText.toLowerCase(), ...extraTerms.map((term) => String(term).toLowerCase())]
    };
}

function makeCallableCompletion(name) {
    const normalizedName = String(name || '').trim();
    if (!normalizedName) return null;
    const insertText = isCallableName(normalizedName) ? `${normalizedName}()` : normalizedName;
    return {
        text: insertText,
        displayText: insertText,
        className: isCallableName(normalizedName) ? 'cm-hint-function' : 'cm-hint-symbol',
        terms: [normalizedName.toLowerCase(), insertText.toLowerCase()]
    };
}

function makeKeywordCompletion(keyword) {
    const normalizedKeyword = String(keyword || '').trim();
    if (!normalizedKeyword) return null;
    return {
        text: normalizedKeyword,
        displayText: normalizedKeyword,
        className: 'cm-hint-keyword',
        terms: [normalizedKeyword.toLowerCase()]
    };
}

function makeSnippetCompletion({ trigger, label, snippet }) {
    const normalizedTrigger = String(trigger || '').trim();
    const normalizedLabel = String(label || '').trim();
    const normalizedSnippet = String(snippet || '');
    if (!normalizedTrigger || !normalizedSnippet) return null;

    return {
        text: normalizedTrigger,
        displayText: normalizedLabel || normalizedTrigger,
        className: 'cm-hint-snippet',
        terms: [normalizedTrigger.toLowerCase(), normalizedLabel.toLowerCase()],
        hint(cm, self, completionData) {
            const from = completionData.from;
            const to = completionData.to;
            const cursorToken = '$0';
            const markerIndex = normalizedSnippet.indexOf(cursorToken);
            const preparedSnippet = markerIndex === -1
                ? normalizedSnippet
                : normalizedSnippet.replace(cursorToken, '');

            cm.replaceRange(preparedSnippet, from, to);

            if (markerIndex >= 0) {
                const beforeCursor = preparedSnippet.slice(0, markerIndex);
                const lines = beforeCursor.split('\n');
                const lineOffset = lines.length - 1;
                const chOffset = lines[lines.length - 1].length;
                cm.setCursor({
                    line: from.line + lineOffset,
                    ch: lineOffset === 0 ? from.ch + chOffset : chOffset
                });
            }
        }
    };
}

function dedupeCompletions(entries) {
    const seen = new Set();
    const deduped = [];
    entries.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const identity = `${entry.displayText || entry.text}|${entry.text}`;
        if (seen.has(identity)) return;
        seen.add(identity);
        deduped.push(entry);
    });
    return deduped;
}

function buildLuaCompletions() {
    const entries = [];

    LUA_KEYWORDS.forEach((keyword) => {
        const completion = makeKeywordCompletion(keyword);
        if (completion) entries.push(completion);
    });

    LUA_GLOBALS.forEach((name) => {
        const completion = makeCallableCompletion(name);
        if (completion) entries.push(completion);
    });

    ROBLOX_CLIENT_APIS.forEach((name) => {
        const completion = makeCallableCompletion(name);
        if (completion) entries.push(completion);
    });

    SUNC_APIS.forEach((name) => {
        const completion = makeCallableCompletion(name);
        if (completion) entries.push(completion);
    });

    SNIPPET_COMPLETIONS.forEach((snippetEntry) => {
        const completion = makeSnippetCompletion(snippetEntry);
        if (completion) entries.push(completion);
    });

    return dedupeCompletions(entries);
}

const LUA_COMPLETIONS = buildLuaCompletions();

const HIGHLIGHTED_API_IDENTIFIERS = new Set([
    ...ROBLOX_CLIENT_APIS.map((entry) => String(entry).trim().toLowerCase()),
    ...SUNC_APIS.map((entry) => String(entry).trim().toLowerCase())
].filter(Boolean));

const EDITOR_FONT_SIZE_MIN = 11;
const EDITOR_FONT_SIZE_MAX = 18;
const DEFAULT_EDITOR_PREFERENCES = Object.freeze({
    fontSize: 14,
    lineNumbers: true,
    highlightActiveLine: true,
    lineWrap: false,
    autocomplete: true
});

let editorPreferences = { ...DEFAULT_EDITOR_PREFERENCES };

function parseBooleanPreference(value, fallback) {
    if (value === null || typeof value === 'undefined') {
        return fallback;
    }
    return String(value) !== 'false';
}

function clampEditorFontSize(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return DEFAULT_EDITOR_PREFERENCES.fontSize;
    }
    return Math.max(EDITOR_FONT_SIZE_MIN, Math.min(EDITOR_FONT_SIZE_MAX, Math.round(numeric)));
}

function normalizeEditorPreferences(preferences = {}) {
    return {
        fontSize: clampEditorFontSize(preferences.fontSize),
        lineNumbers: typeof preferences.lineNumbers === 'boolean'
            ? preferences.lineNumbers
            : DEFAULT_EDITOR_PREFERENCES.lineNumbers,
        highlightActiveLine: typeof preferences.highlightActiveLine === 'boolean'
            ? preferences.highlightActiveLine
            : DEFAULT_EDITOR_PREFERENCES.highlightActiveLine,
        lineWrap: typeof preferences.lineWrap === 'boolean'
            ? preferences.lineWrap
            : DEFAULT_EDITOR_PREFERENCES.lineWrap,
        autocomplete: typeof preferences.autocomplete === 'boolean'
            ? preferences.autocomplete
            : DEFAULT_EDITOR_PREFERENCES.autocomplete
    };
}

function readEditorPreferencesFromStorage() {
    const storage = window.safeStorage;
    if (!storage || typeof storage.getItem !== 'function') {
        return { ...DEFAULT_EDITOR_PREFERENCES };
    }

    return normalizeEditorPreferences({
        fontSize: storage.getItem('zyronEditorFontSize'),
        lineNumbers: parseBooleanPreference(
            storage.getItem('zyronEditorLineNumbers'),
            DEFAULT_EDITOR_PREFERENCES.lineNumbers
        ),
        highlightActiveLine: parseBooleanPreference(
            storage.getItem('zyronEditorActiveLine'),
            DEFAULT_EDITOR_PREFERENCES.highlightActiveLine
        ),
        lineWrap: parseBooleanPreference(
            storage.getItem('zyronEditorLineWrap'),
            DEFAULT_EDITOR_PREFERENCES.lineWrap
        ),
        autocomplete: parseBooleanPreference(
            storage.getItem('zyronEditorAutocomplete'),
            DEFAULT_EDITOR_PREFERENCES.autocomplete
        )
    });
}

function applyEditorFontSizeVariable(preferences) {
    const root = document.documentElement;
    if (!root) return;
    root.style.setProperty('--editor-font-size', `${preferences.fontSize}px`);
}

function applyPreferencesToFallbackEditor(fallbackEditor, preferences) {
    if (!fallbackEditor) return;
    fallbackEditor.style.fontSize = `${preferences.fontSize}px`;
    fallbackEditor.style.whiteSpace = preferences.lineWrap ? 'pre-wrap' : 'pre';
    fallbackEditor.style.wordBreak = preferences.lineWrap ? 'break-word' : 'normal';
}

function applyPreferencesToCodeMirror(codeMirror, preferences) {
    if (!codeMirror || typeof codeMirror.setOption !== 'function') return;

    codeMirror.setOption('lineNumbers', preferences.lineNumbers);
    codeMirror.setOption('styleActiveLine', preferences.highlightActiveLine);
    codeMirror.setOption('lineWrapping', preferences.lineWrap);

    const wrapper = codeMirror.getWrapperElement();
    if (wrapper) {
        wrapper.style.fontSize = `${preferences.fontSize}px`;
    }
    codeMirror.refresh();
}

function applyEditorPreferencesToAllEditors() {
    Object.values(editors).forEach((entry) => {
        if (entry && typeof entry.applyPreferences === 'function') {
            entry.applyPreferences(editorPreferences);
        }
    });
}

function persistEditorPreferences(preferences) {
    const storage = window.safeStorage;
    if (!storage || typeof storage.setItem !== 'function') return;
    storage.setItem('zyronEditorFontSize', preferences.fontSize);
    storage.setItem('zyronEditorLineNumbers', preferences.lineNumbers);
    storage.setItem('zyronEditorActiveLine', preferences.highlightActiveLine);
    storage.setItem('zyronEditorLineWrap', preferences.lineWrap);
    storage.setItem('zyronEditorAutocomplete', preferences.autocomplete);
}

function setEditorPreferences(nextPreferences = {}, { persist = true } = {}) {
    editorPreferences = normalizeEditorPreferences({
        ...editorPreferences,
        ...nextPreferences
    });
    applyEditorFontSizeVariable(editorPreferences);
    applyEditorPreferencesToAllEditors();

    if (persist) {
        persistEditorPreferences(editorPreferences);
    }

    return { ...editorPreferences };
}

function getEditorPreferences() {
    return { ...editorPreferences };
}

function loadEditorPreferencesFromStorage() {
    return setEditorPreferences(readEditorPreferencesFromStorage(), { persist: false });
}

applyEditorFontSizeVariable(editorPreferences);

window.setEditorPreferences = setEditorPreferences;
window.getEditorPreferences = getEditorPreferences;
window.loadEditorPreferencesFromStorage = loadEditorPreferencesFromStorage;
window.EDITOR_FONT_SIZE_MIN = EDITOR_FONT_SIZE_MIN;
window.EDITOR_FONT_SIZE_MAX = EDITOR_FONT_SIZE_MAX;
window.DEFAULT_EDITOR_PREFERENCES = { ...DEFAULT_EDITOR_PREFERENCES };

function getCompletionContext(cm) {
    const cursor = cm.getCursor();
    const lineText = cm.getLine(cursor.line).slice(0, cursor.ch);
    const match = lineText.match(/[A-Za-z_][A-Za-z0-9_.:]*$/);
    if (!match) {
        return {
            from: CodeMirror.Pos(cursor.line, cursor.ch),
            to: CodeMirror.Pos(cursor.line, cursor.ch),
            query: ''
        };
    }

    const query = match[0];
    const startCh = cursor.ch - query.length;
    return {
        from: CodeMirror.Pos(cursor.line, startCh),
        to: CodeMirror.Pos(cursor.line, cursor.ch),
        query
    };
}

function provideLuaHints(cm) {
    const context = getCompletionContext(cm);
    const queryLower = context.query.toLowerCase();

    let list = LUA_COMPLETIONS.filter((completion) => {
        if (!queryLower) return true;
        const terms = Array.isArray(completion.terms) ? completion.terms : [];
        return terms.some((term) => term.startsWith(queryLower));
    });

    if (queryLower) {
        list.sort((a, b) => {
            const aStartsWith = (a.displayText || a.text).toLowerCase().startsWith(queryLower) ? 0 : 1;
            const bStartsWith = (b.displayText || b.text).toLowerCase().startsWith(queryLower) ? 0 : 1;
            if (aStartsWith !== bStartsWith) return aStartsWith - bStartsWith;
            return (a.displayText || a.text).localeCompare(b.displayText || b.text);
        });
    }

    return {
        list: list.slice(0, 180),
        from: context.from,
        to: context.to
    };
}

function maybeTriggerAutoHint(cm, change) {
    if (!editorPreferences.autocomplete) return;
    if (typeof cm.showHint !== 'function') return;
    if (cm.state.completionActive) return;

    const inserted = Array.isArray(change?.text) ? change.text.join('') : '';
    if (!inserted) return;
    if (inserted.includes('\n')) return;

    const triggerBySymbol = inserted === '.' || inserted === ':';
    const triggerByWord = /^[A-Za-z_]$/.test(inserted);
    if (!triggerBySymbol && !triggerByWord) return;

    if (triggerByWord) {
        const context = getCompletionContext(cm);
        if (context.query.length < 2) return;
    }

    cm.showHint({
        hint: provideLuaHints,
        completeSingle: false,
        closeCharacters: /[\s()\[\]{};>,]/
    });
}

function addApiOverlay(cm) {
    cm.addOverlay({
        token(stream) {
            if (stream.match(/[A-Za-z_][A-Za-z0-9_]*(?:[.:][A-Za-z_][A-Za-z0-9_]*)*/)) {
                const identifier = stream.current().toLowerCase();
                if (HIGHLIGHTED_API_IDENTIFIERS.has(identifier)) {
                    return 'zyron-api';
                }
                return null;
            }
            stream.next();
            return null;
        }
    });
}

function createEditorElement(id, content) {
    const editorContainer = document.createElement('div');
    editorContainer.id = `editor-${id}`;
    editorContainer.className = 'editor-container hidden';
    editorArea.appendChild(editorContainer);

    if (typeof CodeMirror !== 'function') {
        const fallbackEditor = document.createElement('textarea');
        fallbackEditor.className = 'fallback-editor';
        fallbackEditor.value = content || '';
        editorContainer.appendChild(fallbackEditor);
        applyPreferencesToFallbackEditor(fallbackEditor, editorPreferences);

        const onFallbackInput = () => {
            const tab = TABS_DATA.find(t => t.id === id);
            if (tab) {
                tab.content = fallbackEditor.value;
                debouncedAutoSave();
            }
        };

        fallbackEditor.addEventListener('input', onFallbackInput);

        editors[id] = {
            session: {
                getValue() {
                    return fallbackEditor.value;
                },
                setValue(nextValue) {
                    fallbackEditor.value = typeof nextValue === 'string' ? nextValue : '';
                }
            },
            applyPreferences(preferences) {
                applyPreferencesToFallbackEditor(fallbackEditor, preferences);
            },
            resize() {},
            focus() {
                fallbackEditor.focus();
            },
            destroy() {
                fallbackEditor.removeEventListener('input', onFallbackInput);
                if (fallbackEditor.parentNode) {
                    fallbackEditor.parentNode.removeChild(fallbackEditor);
                }
            }
        };
        return;
    }

    const codeMirror = CodeMirror(editorContainer, {
        value: content || '',
        mode: 'lua',
        theme: 'zyron',
        lineNumbers: editorPreferences.lineNumbers,
        lineWrapping: editorPreferences.lineWrap,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        smartIndent: true,
        matchBrackets: true,
        styleActiveLine: editorPreferences.highlightActiveLine,
        scrollbarStyle: 'native',
        hintOptions: {
            hint: provideLuaHints,
            completeSingle: false
        },
        extraKeys: {
            Tab(cm) {
                if (cm.state.completionActive && typeof cm.state.completionActive.pick === 'function') {
                    cm.state.completionActive.pick();
                    return;
                }
                if (cm.somethingSelected()) {
                    cm.indentSelection('add');
                    return;
                }
                cm.replaceSelection('    ', 'end');
            },
            'Shift-Tab'(cm) {
                cm.indentSelection('subtract');
            },
            'Ctrl-Space'(cm) {
                if (!editorPreferences.autocomplete) return;
                if (typeof cm.showHint === 'function') {
                    cm.showHint({
                        hint: provideLuaHints,
                        completeSingle: false
                    });
                }
            }
        }
    });
    applyPreferencesToCodeMirror(codeMirror, editorPreferences);

    addApiOverlay(codeMirror);

    const onCodeMirrorChange = () => {
        const tab = TABS_DATA.find(t => t.id === id);
        if (tab) {
            tab.content = codeMirror.getValue();
            debouncedAutoSave();
        }
    };

    const onCodeMirrorInputRead = (cm, change) => {
        maybeTriggerAutoHint(cm, change);
    };

    codeMirror.on('change', onCodeMirrorChange);
    codeMirror.on('inputRead', onCodeMirrorInputRead);

    editors[id] = {
        session: {
            getValue() {
                return codeMirror.getValue();
            },
            setValue(nextValue) {
                codeMirror.setValue(typeof nextValue === 'string' ? nextValue : '');
            }
        },
        applyPreferences(preferences) {
            applyPreferencesToCodeMirror(codeMirror, preferences);
        },
        resize() {
            codeMirror.refresh();
        },
        focus() {
            codeMirror.focus();
        },
        destroy() {
            codeMirror.off('change', onCodeMirrorChange);
            codeMirror.off('inputRead', onCodeMirrorInputRead);
            const wrapper = codeMirror.getWrapperElement();
            if (wrapper && wrapper.parentNode) {
                wrapper.parentNode.removeChild(wrapper);
            }
        }
    };
}
async function executeScript() {
    if (killSwitchEnabled) {
        showNotification('Kill Switch is enabled. Execution is disabled.', 'error');
        executeBtn.disabled = true;
        return;
    }

    const scriptContent = editors[activeTabId]?.session.getValue();
    if (!scriptContent) return;
    executeBtn.textContent = 'Executing...';
    executeBtn.disabled = true;
    try {
        const result = await window.electronAPI.executeScript(scriptContent);
        if (!result.success) {
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
