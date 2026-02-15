const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');

const GITHUB_OWNER = 'a-guy-lol';
const GITHUB_REPO = 'zAPP';
const GITHUB_API_BASE = 'https://api.github.com';

let mainWindow = null;
let pendingUpdate = null;
let downloadedUpdate = null;
let isDownloading = false;

function sendUpdateLog(message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-log', message);
  }
}

function sendUpdateError(errorMessage) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-error', { error: errorMessage });
  }
}

function sendUpdateAvailable(info) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-available', info);
  }
}

function sendDownloadProgress(progressObj) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
}

function sendUpdateDownloaded(info) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-downloaded', info);
  }
}

function parseVersion(rawVersion) {
  const normalized = String(rawVersion || '').trim().replace(/^v/i, '');
  const main = normalized.split('-')[0];
  const parts = main.split('.').map((part) => Number.parseInt(part, 10));
  while (parts.length < 3) parts.push(0);
  return parts.map((part) => (Number.isFinite(part) ? part : 0));
}

function compareVersions(versionA, versionB) {
  const a = parseVersion(versionA);
  const b = parseVersion(versionB);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return 1;
    if (a[i] < b[i]) return -1;
  }
  return 0;
}

function apiJson(pathname) {
  return new Promise((resolve, reject) => {
    const url = `${GITHUB_API_BASE}${pathname}`;
    const request = https.get(url, {
      headers: {
        'User-Agent': 'Zyron-Updater',
        Accept: 'application/vnd.github+json'
      }
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(new Error(`GitHub API ${response.statusCode}: ${body.slice(0, 240)}`));
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Invalid GitHub API response: ${error.message}`));
        }
      });
    });

    request.on('error', reject);
  });
}

function pickZipAsset(release) {
  if (!release || !Array.isArray(release.assets)) return null;
  const zipAssets = release.assets.filter((asset) => {
    const name = String(asset?.name || '').toLowerCase();
    return name.endsWith('.zip') && !name.endsWith('.zip.blockmap');
  });
  if (!zipAssets.length) return null;

  const preferredArch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const universal = zipAssets.find((asset) => /universal.*\.zip$/i.test(asset.name));
  if (universal) return universal;

  const archMatch = zipAssets.find((asset) => {
    const name = String(asset.name || '').toLowerCase();
    return name.includes(preferredArch);
  });
  if (archMatch) return archMatch;

  return zipAssets[0];
}

async function getLatestUpdateCandidate() {
  const release = await apiJson(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`);
  const latestVersion = String(release.tag_name || '').replace(/^v/i, '');
  if (!latestVersion) {
    throw new Error('Latest release has no tag version.');
  }

  const currentVersion = app.getVersion();
  const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
  if (!hasUpdate) {
    return {
      hasUpdate: false,
      latestVersion,
      currentVersion
    };
  }

  const zipAsset = pickZipAsset(release);
  if (!zipAsset || !zipAsset.browser_download_url) {
    throw new Error('No ZIP update asset found in latest release.');
  }

  return {
    hasUpdate: true,
    latestVersion,
    currentVersion,
    release,
    asset: zipAsset,
    info: {
      version: latestVersion,
      name: zipAsset.name,
      notes: release.body || '',
      publishedAt: release.published_at || null
    }
  };
}

function ensureUpdateDirectory() {
  const updatesDir = path.join(app.getPath('userData'), 'updates');
  fs.mkdirSync(updatesDir, { recursive: true });
  return updatesDir;
}

function downloadFileWithProgress(url, outputPath) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'Zyron-Updater',
        Accept: 'application/octet-stream'
      }
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        return resolve(downloadFileWithProgress(response.headers.location, outputPath));
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        return reject(new Error(`Download failed with status ${response.statusCode}`));
      }

      const total = Number(response.headers['content-length'] || 0);
      const fileStream = fs.createWriteStream(outputPath);
      let transferred = 0;
      let lastBytes = 0;
      let lastTime = Date.now();

      response.on('data', (chunk) => {
        transferred += chunk.length;
        const now = Date.now();
        const elapsed = Math.max(1, now - lastTime);
        const bytesPerSecond = Math.round(((transferred - lastBytes) * 1000) / elapsed);
        lastBytes = transferred;
        lastTime = now;
        const percent = total > 0 ? (transferred / total) * 100 : 0;
        sendDownloadProgress({
          percent,
          transferred,
          total,
          bytesPerSecond
        });
      });

      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close(() => resolve(outputPath));
      });
      fileStream.on('error', (error) => {
        try {
          fs.unlinkSync(outputPath);
        } catch (_) {
          // ignore cleanup failure
        }
        reject(error);
      });
    });

    request.on('error', reject);
  });
}

function getCurrentAppBundlePath() {
  if (!app.isPackaged) return null;
  const exePath = process.execPath;
  const candidate = path.resolve(exePath, '..', '..', '..');
  if (candidate.toLowerCase().endsWith('.app')) {
    return candidate;
  }
  return null;
}

function createInstallerHelperScript() {
  const helperPath = path.join(os.tmpdir(), `zyron-updater-helper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sh`);
  const helperScript = `#!/bin/bash
set -e

ZIP_PATH="$1"
TARGET_APP="$2"
APP_PID="$3"

if [ -z "$ZIP_PATH" ] || [ -z "$TARGET_APP" ] || [ -z "$APP_PID" ]; then
  exit 1
fi

for _ in $(seq 1 240); do
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    break
  fi
  sleep 0.25
done

WORK_DIR=$(mktemp -d /tmp/zyron-update-XXXXXX)
cleanup() {
  rm -rf "$WORK_DIR" >/dev/null 2>&1 || true
  rm -f "$0" >/dev/null 2>&1 || true
}
trap cleanup EXIT

/usr/bin/ditto -x -k "$ZIP_PATH" "$WORK_DIR"
NEW_APP=$(find "$WORK_DIR" -maxdepth 4 -name "*.app" -type d -print -quit)
if [ -z "$NEW_APP" ]; then
  exit 1
fi

install_copy() {
  rm -rf "$TARGET_APP"
  /usr/bin/ditto -rsrc "$NEW_APP" "$TARGET_APP"
}

if ! install_copy 2>/dev/null; then
  OSA_RAW="rm -rf \\"$TARGET_APP\\" && ditto -rsrc \\"$NEW_APP\\" \\"$TARGET_APP\\" && xattr -r -d com.apple.quarantine \\"$TARGET_APP\\" || true"
  OSA_ESCAPED=$(printf '%s' "$OSA_RAW" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g')
  /usr/bin/osascript -e "do shell script \\"$OSA_ESCAPED\\" with administrator privileges"
else
  /usr/bin/xattr -r -d com.apple.quarantine "$TARGET_APP" >/dev/null 2>&1 || true
fi

rm -f "$ZIP_PATH" >/dev/null 2>&1 || true
/usr/bin/open -a "$TARGET_APP" >/dev/null 2>&1 || /usr/bin/open "$TARGET_APP" >/dev/null 2>&1 || true
`;
  fs.writeFileSync(helperPath, helperScript, { mode: 0o755 });
  return helperPath;
}

async function performUpdateCheck({ emitAvailableEvent = false, allowInDev = false } = {}) {
  if (!allowInDev && !app.isPackaged) {
    const message = 'Updates only available in packaged app.';
    sendUpdateLog(message);
    return { success: false, message };
  }

  sendUpdateLog('Checking for update...');
  try {
    const candidate = await getLatestUpdateCandidate();
    if (!candidate.hasUpdate) {
      pendingUpdate = null;
      downloadedUpdate = null;
      const message = `You are up to date (${candidate.currentVersion}).`;
      sendUpdateLog(message);
      return {
        success: true,
        message,
        updateInfo: null
      };
    }

    pendingUpdate = candidate;
    downloadedUpdate = null;
    sendUpdateLog(`Update available: ${candidate.latestVersion}`);
    if (emitAvailableEvent) {
      sendUpdateAvailable(candidate.info);
    }

    return {
      success: true,
      updateInfo: {
        updateInfo: candidate.info
      }
    };
  } catch (error) {
    sendUpdateLog(`Update check error: ${error.message}`);
    sendUpdateError(error.message);
    return { success: false, error: error.message };
  }
}

async function performDownloadUpdate() {
  if (isDownloading) {
    const message = 'Update download already in progress.';
    sendUpdateError(message);
    return { success: false, message };
  }

  if (!app.isPackaged) {
    const message = 'Downloads only work in packaged app.';
    sendUpdateLog(message);
    sendUpdateError(message);
    return { success: false, message };
  }

  if (!pendingUpdate) {
    const checkResult = await performUpdateCheck({ emitAvailableEvent: false, allowInDev: false });
    if (!checkResult.success || !pendingUpdate) {
      const errorMessage = checkResult.error || checkResult.message || 'No pending update found.';
      sendUpdateError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  const updatesDir = ensureUpdateDirectory();
  const outputPath = path.join(updatesDir, pendingUpdate.asset.name);
  isDownloading = true;
  sendUpdateLog(`Downloading ${pendingUpdate.asset.name}...`);

  try {
    await downloadFileWithProgress(pendingUpdate.asset.browser_download_url, outputPath);
    downloadedUpdate = {
      version: pendingUpdate.latestVersion,
      zipPath: outputPath,
      info: pendingUpdate.info
    };
    sendUpdateLog('Update downloaded successfully.');
    sendUpdateDownloaded(pendingUpdate.info);
    return { success: true };
  } catch (error) {
    sendUpdateLog(`Download update error: ${error.message}`);
    sendUpdateError(error.message);
    return { success: false, error: error.message };
  } finally {
    isDownloading = false;
  }
}

function performInstallUpdate() {
  if (!downloadedUpdate || !downloadedUpdate.zipPath || !fs.existsSync(downloadedUpdate.zipPath)) {
    const message = 'No downloaded update found.';
    sendUpdateError(message);
    return { success: false, error: message };
  }

  const appBundlePath = getCurrentAppBundlePath();
  if (!appBundlePath) {
    const message = 'Install update only works from a packaged app bundle.';
    sendUpdateError(message);
    return { success: false, error: message };
  }

  try {
    const helperPath = createInstallerHelperScript();
    const child = spawn('/bin/bash', [helperPath, downloadedUpdate.zipPath, appBundlePath, String(process.pid)], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    sendUpdateLog('Installing update and restarting...');
    app.quit();
    return { success: true };
  } catch (error) {
    sendUpdateError(`Failed to start installer: ${error.message}`);
    return { success: false, error: error.message };
  }
}

ipcMain.handle('check-for-updates', async () => performUpdateCheck({ emitAvailableEvent: true, allowInDev: false }));

ipcMain.handle('check-for-updates-force', async () => performUpdateCheck({ emitAvailableEvent: true, allowInDev: true }));

ipcMain.handle('download-update', async () => performDownloadUpdate());

ipcMain.handle('install-update', async () => performInstallUpdate());

ipcMain.handle('get-app-version', () => app.getVersion());

function initialize(window) {
  mainWindow = window;
}

function checkForUpdates() {
  performUpdateCheck({ emitAvailableEvent: true, allowInDev: false });
}

module.exports = {
  initialize,
  checkForUpdates
};
