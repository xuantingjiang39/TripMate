'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', Object.freeze({
  action: name => {
    if (['retry', 'reload', 'browser', 'pdf', 'zoom-in', 'zoom-out', 'zoom-reset'].includes(name)) ipcRenderer.send('shell:action', name);
  },
  onState: callback => {
    if (typeof callback === 'function') ipcRenderer.on('shell:state', (_event, state) => callback(state));
  }
}));
