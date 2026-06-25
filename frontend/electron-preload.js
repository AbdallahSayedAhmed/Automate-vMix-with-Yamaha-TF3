const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  restartBackend: () => ipcRenderer.send('restart-backend'),
  openLogs: () => ipcRenderer.send('open-logs'),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
  showAppMenu: () => ipcRenderer.send('show-context-menu'),
  onRefreshInputs: (callback) => {
    const wrapped = (_event, ...args) => callback(...args);
    ipcRenderer.on('trigger-refresh-inputs', wrapped);
    return () => ipcRenderer.removeListener('trigger-refresh-inputs', wrapped);
  },
});
