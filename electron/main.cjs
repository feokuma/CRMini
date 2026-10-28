const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { applyMigrations } = require("./database-migrations.cjs");
const { createDatabaseManager } = require("./database-manager.cjs");
const { createServerLifecycle } = require("./server-lifecycle.cjs");
const { standaloneDir } = require("./resource-paths.cjs");

const host = "127.0.0.1";
const isDevelopment = process.argv.includes("--dev");
const resourcesDir = standaloneDir({ app, isDevelopment, dirname: __dirname });
const dataDir = app.getPath("userData");
let mainWindow;
let serverStoppedForQuit = false;

app.setAppUserModelId("br.com.crmini.app");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  const server = createServerLifecycle({
    projectDir: path.resolve(__dirname, ".."),
    resourcesDir,
    dataDir,
    isDevelopment,
    host,
  });

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

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  function isServerUrl(url) {
    try {
      const target = new URL(url);
      return target.origin === new URL(server.url).origin;
    } catch {
      return false;
    }
  }

  function openExternal(url) {
    // Só http(s): evita abrir `file:`, `javascript:` ou outros esquemas vindos de
    // um link renderizado na página.
    try {
      const { protocol } = new URL(url);
      if (protocol !== "http:" && protocol !== "https:") return;
    } catch {
      return;
    }
    shell.openExternal(url).catch(() => {});
  }

  function windowIcon() {
    // No dev o ícone ainda não foi gerado: só usa se o arquivo existir.
    const candidate = app.isPackaged
      ? path.join(process.resourcesPath, "icon.ico")
      : path.join(__dirname, "..", "build", "icon.ico");
    return fs.existsSync(candidate) ? candidate : undefined;
  }

  async function createWindow() {
    const databasePath = await databaseManager.chooseDatabase();
    if (!databasePath) {
      app.quit();
      return;
    }
    try {
      await applyMigrations({ databasePath, resourcesDir });
    } catch (error) {
      console.error(error);
      // A preferência só é salva depois da migração: se o banco falhar, a próxima
      // abertura volta a oferecer a escolha em vez de repetir o mesmo erro.
      dialog.showErrorBox("Não foi possível atualizar o banco", error.message);
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
        icon: windowIcon(),
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      // Navegação restrita ao servidor local: links internos seguem na mesma
      // janela; qualquer outra origem vai para o navegador externo. Nunca abre
      // janela filha, que escaparia destes handlers.
      mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (isServerUrl(url)) mainWindow.loadURL(url).catch(() => {});
        else openExternal(url);
        return { action: "deny" };
      });
      mainWindow.webContents.on("will-navigate", (event, url) => {
        if (isServerUrl(url)) return;
        event.preventDefault();
        openExternal(url);
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
}
