const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("livedockDesktop", {
  isDesktop: true,
  platform: process.platform,
});
