const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');
const hydrogenAPI = require('./hydrogen-api');

ipcMain.handle('get-scripts', async () => {
    try {
        const scriptsDir = path.join(__dirname, '..', 'src', 'scripts');
        if (!fs.existsSync(scriptsDir)) {
            return [];
        }
        
        const scriptFolders = fs.readdirSync(scriptsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        const scripts = [];
        
        for (const folderName of scriptFolders) {
            const scriptPath = path.join(scriptsDir, folderName);
            const script = {
                name: folderName,
                path: scriptPath,
                description: '',
                thumbnail: null,
                type: 'free',
                author: '',
                supportsExecuteOnJoin: true
            };
            
            const configPath = path.join(scriptPath, 'config.json');
            if (fs.existsSync(configPath)) {
                try {
                    const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                    script.type = configData.type || 'free';
                    script.author = configData.author || '';
                    script.supportsExecuteOnJoin = configData.supportsExecuteOnJoin !== false;
                    if (configData.name) script.name = configData.name;
                    if (configData.description) script.description = configData.description;
                } catch (error) {
                    console.error(`Failed to parse config for ${folderName}:`, error);
                }
            }
            
            if (!script.description) {
                const descPath = path.join(scriptPath, 'description.txt');
                if (fs.existsSync(descPath)) {
                    script.description = fs.readFileSync(descPath, 'utf-8').trim();
                }
            }
            
            const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
            for (const ext of imageExts) {
                const imgPath = path.join(scriptPath, 'image' + ext);
                if (fs.existsSync(imgPath)) {
                    script.thumbnail = imgPath;
                    break;
                }
            }
            
            const luaPath = path.join(scriptPath, 'script.lua');
            if (fs.existsSync(luaPath)) {
                scripts.push(script);
            }
        }
        
        return scripts;
    } catch (error) {
        console.error('Error getting scripts:', error);
        return [];
    }
});

ipcMain.handle('execute-hub-script', async (event, scriptPath, savedKey = null) => {
    try {
        const luaFile = path.join(scriptPath, 'script.lua');
        if (!fs.existsSync(luaFile)) {
            return { success: false, message: 'Script file not found' };
        }
        
        const scriptName = path.basename(scriptPath);
        let scriptContent;
        
        if (scriptName === 'Sensation') {
            console.log('Executing Sensation with savedKey:', savedKey);
            if (savedKey && savedKey.trim()) {
                scriptContent = `script_key="${savedKey}";
loadstring(game:HttpGet("https://api.luarmor.net/files/v3/loaders/730854e5b6499ee91deb1080e8e12ae3.lua"))()`;
                console.log('Using paid version with key');
            } else {
                scriptContent = `loadstring(game:HttpGet("https://api.luarmor.net/files/v4/loaders/730854e5b6499ee91deb1080e8e12ae3.lua"))()`;
                console.log('Using free version (no key)');
            }
        } else {
            scriptContent = fs.readFileSync(luaFile, 'utf-8');
            if (savedKey && savedKey.trim()) {
                scriptContent = `script_key="${savedKey}";\n${scriptContent}`;
            }
        }
        
        return await hydrogenAPI.executeScript(scriptContent);
    } catch (error) {
        return { success: false, message: error.message };
    }
});

function initialize() {
}

module.exports = {
    initialize
};
