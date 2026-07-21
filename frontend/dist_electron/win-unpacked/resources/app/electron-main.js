import { app, BrowserWindow, dialog, screen, ipcMain, shell, Tray, Menu, globalShortcut } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import http from 'http';
import net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let backendProcess = null;
let tray = null;
let backendPort = 8000;
let backendUrl = `http://127.0.0.1:${backendPort}`;

const BACKEND_HOST = '127.0.0.1';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getIconPath() {
  return app.isPackaged
    ? path.join(__dirname, 'dist', 'program-image.ico')
    : path.join(__dirname, 'public', 'program-image.ico');
}

function getInstallDir() {
  return app.isPackaged
    ? path.resolve(process.resourcesPath, '..')
    : path.resolve(__dirname, '..');
}

function writeBridgeLog(message) {
  try {
    const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
    fs.appendFileSync(path.join(getInstallDir(), 'bridge.log'), `${timestamp} | ${message}\n`, 'utf8');
  } catch (err) {
    console.error('Could not write bridge log:', err);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    let settled = false;

    const finish = (available) => {
      if (settled) return;
      settled = true;
      resolve(available);
    };

    server.once('error', () => finish(false));
    server.once('listening', () => {
      server.close(() => finish(true));
    });

    server.listen(port, BACKEND_HOST);
  });
}

async function findAvailableBackendPort(startPort = 8000, attempts = 50) {
  for (let offset = 0; offset < attempts; offset++) {
    const candidate = startPort + offset;
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
    writeBridgeLog(`Port ${candidate} is busy; trying the next port.`);
  }

  throw new Error(`No available local port found between ${startPort} and ${startPort + attempts - 1}.`);
}

function checkBackendHealth() {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (healthy) => {
      if (settled) return;
      settled = true;
      resolve(healthy);
    };

    const req = http.get(`${backendUrl}/api/health`, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          finish(false);
          return;
        }

        try {
          const health = JSON.parse(body);
          finish(health.status === 'ok' && health.frontend_ready !== false);
        } catch {
          finish(true);
        }
      });
    });

    req.setTimeout(2000, () => {
      req.destroy();
      finish(false);
    });
    req.on('error', () => finish(false));
  });
}

async function waitForBackend(timeoutSeconds = 30) {
  for (let attempt = 1; attempt <= timeoutSeconds; attempt++) {
    if (backendProcess && backendProcess.exitCode !== null) {
      throw new Error(`Backend exited during startup with code ${backendProcess.exitCode}.`);
    }

    if (await checkBackendHealth()) {
      writeBridgeLog(`Backend became ready on ${backendUrl}.`);
      return;
    }

    await delay(1000);
  }

  throw new Error(`Backend failed to start after ${timeoutSeconds} seconds on ${backendUrl}.`);
}

// ─── Backend ──────────────────────────────────────────────────────────────────
async function startBackend() {
  if (!app.isPackaged) {
    return;
  }

  const installDir = getInstallDir();
  const backendExePath = path.join(installDir, 'backend.exe');
  const backendLogPath = path.join(installDir, 'backend.log');

  backendPort = await findAvailableBackendPort(8000);
  backendUrl = `http://${BACKEND_HOST}:${backendPort}`;

  writeBridgeLog(`Starting backend: ${backendExePath}`);
  writeBridgeLog(`Backend URL: ${backendUrl}`);
  writeBridgeLog(`Backend working directory: ${installDir}`);

  const backendLogStream = fs.createWriteStream(backendLogPath, { flags: 'a' });
  backendLogStream.write(`\n==== Backend start ${new Date().toISOString()} on ${backendUrl} ====\n`);

  backendProcess = spawn(backendExePath, [], {
    cwd: installDir,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: {
      ...process.env,
      BRIDGE_BACKEND_HOST: BACKEND_HOST,
      BRIDGE_BACKEND_PORT: String(backendPort),
    },
  });

  backendProcess.stdout?.on('data', (data) => backendLogStream.write(data));
  backendProcess.stderr?.on('data', (data) => backendLogStream.write(data));
  backendProcess.on('exit', (code, signal) => {
    backendLogStream.write(`\n==== Backend exited code=${code} signal=${signal} ${new Date().toISOString()} ====\n`);
    backendLogStream.end();
    writeBridgeLog(`Backend exited with code=${code} signal=${signal}.`);
  });

  writeBridgeLog(`Backend process started with PID ${backendProcess.pid}.`);
  await waitForBackend(30);
}

// ─── Main Window ──────────────────────────────────────────────────────────────
function createWindow() {
  const displays = screen.getAllDisplays();
  let windowBounds = {};
  if (displays.length > 1) {
    const ext = displays.find((d) => d.bounds.x !== 0 || d.bounds.y !== 0) || displays[1];
    windowBounds = { x: ext.bounds.x + 50, y: ext.bounds.y + 50 };
  }

  // FIXED: preload must be .cjs because package.json has "type":"module".
  // Electron's preload sandbox is CommonJS-only and cannot load ESM — using
  // .cjs forces Node to treat the file as CommonJS regardless of "type".
  const preloadPath = path.join(__dirname, 'electron-preload.cjs');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    ...windowBounds,
    icon: getIconPath(),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0b0f1a',
      symbolColor: '#8b93a8',
      height: 38,
    },
    backgroundColor: '#070a0f',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
    show: false,
  });

  mainWindow.setMenu(null);
  mainWindow.removeMenu();
  mainWindow.setMenuBarVisibility(false);

  // Catch F11 inside web content before Chromium handles it
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      _event.preventDefault();
      toggleFullscreen();
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (app.isPackaged) {
    mainWindow.loadURL(`${backendUrl}/`);
  } else {
    mainWindow.loadURL('http://localhost:5173/');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Fullscreen toggle ────────────────────────────────────────────────────────
// Centralised so every code path (IPC, tray, F11, global shortcut) uses the
// same logic and never silently no-ops on a null/destroyed window.
function toggleFullscreen() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
}

// ─── vMix input refresh ───────────────────────────────────────────────────────
function sendRefreshInputs() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('trigger-refresh-inputs');
}

// ─── System Tray ──────────────────────────────────────────────────────────────
function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'vMix-Yamaha Bridge', enabled: false },
    { type: 'separator' },
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
      },
    },
    { label: 'Restart Backend', click: () => restartBackend() },
    { label: 'Toggle Fullscreen', click: () => toggleFullscreen() },
    { label: 'Refresh vMix Inputs', click: () => sendRefreshInputs() },
    { label: 'View Logs', click: () => openLogs() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

function createTray() {
  tray = new Tray(getIconPath());
  tray.setToolTip('vMix-Yamaha Bridge');
  tray.setContextMenu(buildTrayMenu());
  tray.on('double-click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
}

// ─── Actions ──────────────────────────────────────────────────────────────────
async function restartBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
    await delay(500);
  }
  try {
    await startBackend();
    if (mainWindow) mainWindow.loadURL(`${backendUrl}/`);
  } catch (err) {
    dialog.showErrorBox('Restart Failed', 'The backend failed to restart.\n\n' + err.message);
  }
}

function openLogs() {
  const installDir = getInstallDir();
  shell.openPath(path.join(installDir, 'install.log')).catch(console.error);
  shell.openPath(path.join(installDir, 'bridge.log')).catch(console.error);
  shell.openPath(path.join(installDir, 'backend.log')).catch(console.error);
}

function showAppContextMenu() {
  const menu = Menu.buildFromTemplate([
    { label: 'Restart Backend', click: () => restartBackend() },
    { label: 'Toggle Fullscreen', click: () => toggleFullscreen() },
    { label: 'View Logs', click: () => openLogs() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  if (mainWindow) menu.popup({ window: mainWindow });
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────
function setupIPC() {
  ipcMain.on('restart-backend', () => restartBackend());
  ipcMain.on('open-logs', () => openLogs());

  // FIXED: was working but centralised through toggleFullscreen() now
  ipcMain.on('toggle-fullscreen', () => toggleFullscreen());

  ipcMain.on('show-context-menu', () => showAppContextMenu());

  // Renderer-initiated refresh (e.g. button click forwarded via IPC)
  ipcMain.on('refresh-vmix-inputs-from-main', () => sendRefreshInputs());
}

// ─── Global shortcuts ─────────────────────────────────────────────────────────
function registerShortcuts() {
  // FIXED: these now use the shared sendRefreshInputs() / toggleFullscreen()
  // helpers so there's no chance of a stale mainWindow reference.
  const refreshOk = globalShortcut.register('CommandOrControl+Shift+R', () => {
    sendRefreshInputs();
  });
  if (!refreshOk) console.warn('Global shortcut Ctrl+Shift+R could not be registered');

  const f11Ok = globalShortcut.register('F11', () => {
    toggleFullscreen();
  });
  if (!f11Ok) console.warn('Global shortcut F11 could not be registered');
}

// ─── App lifecycle ─────────────────────────────────────────────────────────────
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    setupIPC();
    createTray();
    registerShortcuts();

    try {
      await startBackend();
      createWindow();
    } catch (err) {
      console.error(err);
      writeBridgeLog(`Startup failed: ${err.message}`);
      dialog.showErrorBox('Failed to start', 'The backend server failed to start.\n\n' + err.message);
      app.quit();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (backendProcess) backendProcess.kill();
  if (tray) tray.destroy();
});
