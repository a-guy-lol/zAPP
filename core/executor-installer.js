const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ipcMain } = require('electron');

const EXECUTOR_CONFIG = {
    macsploit: {
        appBundleName: 'MacSploit.app',
        installCommand: 'cd ~/ && curl -s "https://git.abyssdigital.xyz/main/install.sh" | bash </dev/tty'
    },
    hydrogen: {
        appBundleName: 'Hydrogen.app',
        installCommand: 'bash -c "$(curl -fsSL https://www.hydrogen.lat/install)"'
    },
    opiumware: {
        appBundleName: 'Opiumware.app',
        installCommand: 'bash <(curl -fsSL "https://raw.githubusercontent.com/norbyv1/OpiumwareInstall/main/inst")'
    }
};

function normalizeExecutor(executor) {
    if (executor === 'hydrogen') return 'hydrogen';
    if (executor === 'macsploit') return 'macsploit';
    if (executor === 'opiumware') return 'opiumware';
    return null;
}

function getExecutorInstallStatus() {
    const applicationsPath = '/Applications';
    return {
        hydrogen: fs.existsSync(path.join(applicationsPath, EXECUTOR_CONFIG.hydrogen.appBundleName)),
        macsploit: fs.existsSync(path.join(applicationsPath, EXECUTOR_CONFIG.macsploit.appBundleName)),
        opiumware: fs.existsSync(path.join(applicationsPath, EXECUTOR_CONFIG.opiumware.appBundleName))
    };
}

function getExecutorBundlePath(executor) {
    return path.join('/Applications', EXECUTOR_CONFIG[executor].appBundleName);
}

function escapeAppleScriptString(value) {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
}

function launchInTerminal(command) {
    return new Promise((resolve) => {
        const script = [
            'tell application "Terminal"',
            'activate',
            `do script "${escapeAppleScriptString(command)}"`,
            'end tell'
        ].join('\n');
        const child = spawn('osascript', ['-e', script], {
            stdio: 'ignore'
        });

        child.once('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        child.once('exit', (code) => {
            if (code === 0) {
                resolve({ success: true });
                return;
            }
            resolve({ success: false, error: `Failed to launch Terminal (exit ${code}).` });
        });
    });
}

function initialize() {
    ipcMain.handle('get-executor-install-status', () => {
        return {
            success: true,
            status: getExecutorInstallStatus()
        };
    });

    ipcMain.handle('install-executor', async (event, rawExecutor) => {
        const executor = normalizeExecutor(rawExecutor);
        if (!executor) {
            return { success: false, error: 'Invalid executor.' };
        }

        const installCommand = EXECUTOR_CONFIG[executor].installCommand;
        const launchResult = await launchInTerminal(installCommand);
        if (!launchResult.success) {
            return launchResult;
        }

        return {
            success: true,
            executor,
            command: installCommand
        };
    });

    ipcMain.handle('uninstall-executor', async (event, rawExecutor) => {
        const executor = normalizeExecutor(rawExecutor);
        if (!executor) {
            return { success: false, error: 'Invalid executor.' };
        }

        const bundlePath = getExecutorBundlePath(executor);
        if (!fs.existsSync(bundlePath)) {
            return {
                success: true,
                executor,
                removed: false
            };
        }

        try {
            fs.rmSync(bundlePath, { recursive: true, force: true });
            return {
                success: true,
                executor,
                removed: true
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    });
}

module.exports = {
    initialize
};
