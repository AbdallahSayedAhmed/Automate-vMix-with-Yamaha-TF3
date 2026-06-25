const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Commands → Main process
  restartBackend:  () => ipcRenderer.send('restart-backend'),
  openLogs:        () => ipcRenderer.send('open-logs'),
  toggleFullscreen:() => ipcRenderer.send('toggle-fullscreen'),
  showAppMenu:     () => ipcRenderer.send('show-context-menu'),

  // Listen for "trigger refresh" signal sent from Main (global shortcut)
  onRefreshInputs: (callback) => {
    ipcRenderer.on('trigger-refresh-inputs', callback);
    // Return cleanup function
    return () => ipcRenderer.removeListener('trigger-refresh-inputs', callback);
  },
});
