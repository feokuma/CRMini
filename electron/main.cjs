const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { createDatabaseManager } = require("./database-manager.cjs");
const { createServerLifecycle } = require("./server-lifecycle.cjs");
const path = require("node:path");

const host = "127.0.0.1";
const isDevelopment = process.argv.includes("--dev");
let mainWindow;
let serverStoppedForQuit = false;
const server = createServerLifecycle({ projectDir: path.resolve(__dirname, ".."), isDevelopment, host });

const databaseManager = createDatabaseManager({
  app,
  dialog,
  getMainWindow: () => mainWindow,
  beforeRestart: () => server.stop(),
  getServerUrl: () => server.url,
});

ipcMain.handle("database:get-path", (event) =>
  databaseManager.handleGetPath(event),
);
ipcMain.handle("database:choose", (event) =>
  databaseManager.handleChoose(event),
);

async function createWindow() {
  const databasePath = await databaseManager.chooseDatabase();
  if (!databasePath) {
    app.quit();
    return;
  }
  databaseManager.saveDatabasePath(databasePath);
  try {
    const serverUrl = await server.start(databasePath);
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 900,
      minHeight: 600,
      webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false },
    });
    await mainWindow.loadURL(serverUrl);
  } catch (error) {
    console.error(error);
    app.quit();
  }
}

app
  .whenReady()
  .then(createWindow)
  .catch((error) => {
    dialog.showErrorBox("Erro no banco", error.message);
    app.quit();
  });
app.on("window-all-closed", () => app.quit());
app.on("before-quit", (event) => {
  if (serverStoppedForQuit) return;
  event.preventDefault();
  server.stop().finally(() => {
    serverStoppedForQuit = true;
    app.quit();
  });
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
