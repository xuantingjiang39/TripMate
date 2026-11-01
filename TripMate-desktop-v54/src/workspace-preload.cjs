'use strict';
const { contextBridge, ipcRenderer } = require('electron');
// The remote page gets only one capability. No file paths, shell commands or generic IPC.
contextBridge.exposeInMainWorld('tripmateDesktop', Object.freeze({
  printPDF: () => ipcRenderer.send('workspace:pdf')
}));
