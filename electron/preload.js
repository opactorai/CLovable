const { contextBridge, ipcRenderer } = require('electron');

/**
 * Define a safe bridge accessible from the renderer.
 * Extend the required APIs below.
 */
contextBridge.exposeInMainWorld('desktopAPI', {
  ping: () => ipcRenderer.invoke('ping'),
});
