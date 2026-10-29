const { contextBridge, ipcRenderer } = require("electron");

// Repassa só o snapshot: o `event` do IPC dá acesso ao remetente e não pode
// atravessar o contextBridge.
function subscribeToUpdateState(listener) {
  if (typeof listener !== "function") {
    throw new TypeError("onState exige uma função.");
  }
  const handler = (_event, snapshot) => listener(snapshot);
  ipcRenderer.on("updates:state", handler);
  return () => ipcRenderer.removeListener("updates:state", handler);
}

contextBridge.exposeInMainWorld("crmDesktop", {
  getDatabasePath: () => ipcRenderer.invoke("database:get-path"),
  chooseDatabase: () => ipcRenderer.invoke("database:choose"),
  getAssetsPath: () => ipcRenderer.invoke("assets:get-path"),
  getSidebarCollapsed: () =>
    ipcRenderer.invoke("preferences:get-sidebar-collapsed"),
  setSidebarCollapsed: (collapsed) =>
    ipcRenderer.invoke("preferences:set-sidebar-collapsed", collapsed),
  updates: {
    getState: () => ipcRenderer.invoke("updates:get-state"),
    check: () => ipcRenderer.invoke("updates:check"),
    download: () => ipcRenderer.invoke("updates:download"),
    install: () => ipcRenderer.invoke("updates:install"),
    onState: subscribeToUpdateState,
  },
});
