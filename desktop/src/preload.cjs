const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("livedockDesktop", {
  isDesktop: true,
  platform: process.platform,
  selectOutputFolder: () => ipcRenderer.invoke("livedock:select-output-folder"),
});
