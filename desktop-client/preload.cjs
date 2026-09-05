const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    getLocalIP: () => ipcRenderer.invoke('get-local-ip'),
    openApp: (name) => ipcRenderer.invoke('open-app', name),
    openFile: (path) => ipcRenderer.invoke('open-file', path),
    searchFile: (query) => ipcRenderer.invoke('search-file', query),
    takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
    readClipboard: () => ipcRenderer.invoke('read-clipboard'),
    writeClipboard: (text) => ipcRenderer.invoke('write-clipboard', text)
});
