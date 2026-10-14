const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  selectFiles: () => ipcRenderer.invoke('dialog:select-files'),
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  selectDestDir: () => ipcRenderer.invoke('dialog:select-dest-dir'),
  readFile: (filePath) => ipcRenderer.invoke('fs:read-file', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('fs:save-file', filePath, content),
  revealFile: (filePath) => ipcRenderer.invoke('shell:reveal-file', filePath),
  openPath: (filePath) => ipcRenderer.invoke('shell:open-path', filePath),
  getFileInfo: (filePath) => ipcRenderer.invoke('fs:get-file-info', filePath),
  getDocPreview: (filePath) => ipcRenderer.invoke('fs:get-doc-preview', filePath),

  // Prerequisites
  getPrereqStatus: () => ipcRenderer.invoke('prereq:get-status'),
  installLibreOffice: () => ipcRenderer.invoke('prereq:install-libreoffice'),
  installLiteParsePython: () => ipcRenderer.invoke('prereq:install-liteparse-python'),

  // Conversion operations
  startConversion: (fileList, options) => ipcRenderer.invoke('converter:start', fileList, options),
  cancelConversion: () => ipcRenderer.invoke('converter:cancel'),

  // System Integration
  getIntegrationStatus: () => ipcRenderer.invoke('sys:get-status'),
  installSendTo: () => ipcRenderer.invoke('sys:install-sendto'),
  uninstallSendTo: () => ipcRenderer.invoke('sys:uninstall-sendto'),
  installContextMenu: () => ipcRenderer.invoke('sys:install-contextmenu'),
  uninstallContextMenu: () => ipcRenderer.invoke('sys:uninstall-contextmenu'),

  // Presets & Config
  getPresets: () => ipcRenderer.invoke('config:get-presets'),
  savePresets: (presets) => ipcRenderer.invoke('config:save-presets', presets),
  getInitialState: () => ipcRenderer.invoke('app:get-initial-state'),

  // Event Listeners (Main -> Renderer)
  onLog: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('converter:log', handler);
    return () => ipcRenderer.removeListener('converter:log', handler);
  },
  onProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('converter:progress', handler);
    return () => ipcRenderer.removeListener('converter:progress', handler);
  },
  onPageProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('converter:page-progress', handler);
    return () => ipcRenderer.removeListener('converter:page-progress', handler);
  },
  onFileStart: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('converter:file-start', handler);
    return () => ipcRenderer.removeListener('converter:file-start', handler);
  },
  onFileComplete: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('converter:file-complete', handler);
    return () => ipcRenderer.removeListener('converter:file-complete', handler);
  },
  onFileError: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('converter:file-error', handler);
    return () => ipcRenderer.removeListener('converter:file-error', handler);
  },
  onBatchComplete: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('converter:batch-complete', handler);
    return () => ipcRenderer.removeListener('converter:batch-complete', handler);
  },
  onExternalFilesReceived: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('app:external-files', handler);
    return () => ipcRenderer.removeListener('app:external-files', handler);
  }
});
