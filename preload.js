const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('daveAPI', {
  saveFile: (payload) => ipcRenderer.invoke('save-file', payload),
  openFile: () => ipcRenderer.invoke('open-file'),
  confirmDiscard: () => ipcRenderer.invoke('confirm-discard'),
  pickImage: () => ipcRenderer.invoke('pick-image'),
  setDirty: (d) => ipcRenderer.send('set-dirty', d),
  winControl: (action) => ipcRenderer.send('win-control', action),
  print: () => ipcRenderer.send('print'),
  readClipboard: () => ({ html: clipboard.readHTML(), text: clipboard.readText() }),
  onWindowState: (cb) => ipcRenderer.on('window-state', (e, s) => cb(s))
});
