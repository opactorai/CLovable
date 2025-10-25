const { contextBridge, ipcRenderer } = require('electron');

/**
 * 렌더러에서 접근 가능한 안전한 브리지 정의
 * 필요한 API를 아래에 확장하세요.
 */
contextBridge.exposeInMainWorld('desktopAPI', {
  ping: () => ipcRenderer.invoke('ping'),
});
