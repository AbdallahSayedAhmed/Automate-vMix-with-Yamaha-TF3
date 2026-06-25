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
  // In production, __dirname is resources/app — icon lands in resources/app/dist/
  // In development, it lives in public/
  return app.isPackaged
    ? path.join(__dirname, 'dist', 'program-image.ico')
    : path.join(__dirname, 'public', 'program-image.ico');
}

// ─── Backend ──────────────────────────────────────────────────────────────────

function startBackend() {
  if (!app.isPackaged) {
    // Dev mode: backend runs separately
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
  // Pick second display if available
  const displays = screen.getAllDisplays();
  let windowBounds = {};
  if (displays.length > 1) {
    const ext = displays.find((d) => d.bounds.x !== 0 || d.bounds.y !== 0) || displays[1];
    windowBounds = { x: ext.bounds.x + 50, y: ext.bounds.y + 50 };
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    ...windowBounds,
    icon: getIconPath(),
    // Hybrid: use native Windows controls (overlay) but keep our dark design
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
      preload: path.join(__dirname, 'electron-preload.js'),
    },
    autoHideMenuBar: true,
    show: false, // show after ready-to-show to avoid white flash
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadURL('http://127.0.0.1:8000/');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── System Tray ──────────────────────────────────────────────────────────────

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'vMix-Yamaha Bridge',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Restart Backend',
      click: () => restartBackend(),
    },
    {
      label: 'Toggle Fullscreen',
      click: () => {
        if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
      },
    },
    {
      label: 'View Logs',
      click: () => openLogs(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);
}

function createTray() {
  tray = new Tray(getIconPath());
  tray.setToolTip('vMix-Yamaha Bridge');
  tray.setContextMenu(buildTrayMenu());
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ─── Actions ─────────────────────────────────────────────────────────────────

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
    { label: 'Toggle Fullscreen', click: () => { if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen()); } },
    { label: 'View Logs', click: () => openLogs() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  // popup() with a window reference is required for frameless windows
  if (mainWindow) menu.popup({ window: mainWindow });
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

function setupIPC() {
  ipcMain.on('restart-backend', () => restartBackend());
  ipcMain.on('open-logs', () => openLogs());
  ipcMain.on('toggle-fullscreen', () => {
    if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });
  ipcMain.on('show-context-menu', () => showAppContextMenu());
  // Renderer asks us to send back a "refresh-inputs" signal (used by global shortcut)
  ipcMain.on('refresh-vmix-inputs-from-main', () => {
    if (mainWindow) mainWindow.webContents.send('trigger-refresh-inputs');
  });
}

// ─── Global shortcuts ────────────────────────────────────────────────────────

function registerShortcuts() {
  // Ctrl+R (or Ctrl+Shift+R) — refresh vMix inputs
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    if (mainWindow) mainWindow.webContents.send('trigger-refresh-inputs');
  });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    setupIPC();
    await startBackend();
    createWindow();
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
  // On Windows, keep app alive in tray when window is closed
  // app.quit() is only called from the tray menu "Quit" option
  if (process.platform === 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (backendProcess) backendProcess.kill();
});
