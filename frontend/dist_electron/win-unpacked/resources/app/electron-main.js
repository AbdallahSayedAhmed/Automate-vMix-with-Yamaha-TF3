import { app, BrowserWindow, dialog, screen, ipcMain, shell, Tray, Menu, globalShortcut } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let backendProcess = null;
let tray = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getIconPath() {
  return app.isPackaged
    ? path.join(__dirname, 'dist', 'program-image.ico')
    : path.join(__dirname, 'public', 'program-image.ico');
}

// ─── Backend ──────────────────────────────────────────────────────────────────
function startBackend() {
  if (!app.isPackaged) {
    return Promise.resolve();
  }
  const backendExePath = path.join(process.resourcesPath, '..', 'backend.exe');
  backendProcess = spawn(backendExePath, [], {
    detached: false,
    stdio: 'ignore',
  });
  return new Promise((resolve, reject) => {
    let retries = 0;
    const interval = setInterval(() => {
      http.get('http://127.0.0.1:8000/api/health', (res) => {
        if (res.statusCode === 200) {
          clearInterval(interval);
          resolve();
        }
      }).on('error', () => {
        retries++;
        if (retries > 30) {
          clearInterval(interval);
          reject(new Error('Backend failed to start after 30 seconds.'));
        }
      });
    }, 1000);
  });
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
    mainWindow.loadURL('http://127.0.0.1:8000/');
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
  }
  try {
    await startBackend();
    if (mainWindow) mainWindow.reload();
  } catch (err) {
    dialog.showErrorBox('Restart Failed', 'The backend failed to restart.\n\n' + err.message);
  }
}

function openLogs() {
  const installDir = app.isPackaged
    ? path.join(process.resourcesPath, '..')
    : path.join(__dirname, '..', 'installer');
  shell.openPath(path.join(installDir, 'install.log')).catch(console.error);
  shell.openPath(path.join(installDir, 'bridge.log')).catch(console.error);
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
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  try {
    await startBackend();
    createWindow();
    setupIPC();
    createTray();
    registerShortcuts();
  } catch (err) {
    console.error(err);
    dialog.showErrorBox('Failed to start', 'The backend server failed to start.\n\n' + err.message);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (backendProcess) backendProcess.kill();
});
