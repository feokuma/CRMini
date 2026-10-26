const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("crmDesktop", {
  getDatabasePath: () => ipcRenderer.invoke("database:get-path"),
  chooseDatabase: () => ipcRenderer.invoke("database:choose"),
});
