const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const {
  defaultDatabasePath,
  validateDatabase,
  migrateLegacyDatabase,
  selectDatabasePath,
  shouldMigrateLegacy,
} = require("../database/sqlite-paths.cjs");
const http = require("node:http");
const path = require("node:path");

const host = "127.0.0.1";
const port = 3174;
let nextProcess;
let mainWindow;

function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on("error", () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error("Next.js server did not become ready."));
        } else {
          setTimeout(check, 250);
        }
      });
    };
    check();
  });
}

async function chooseDatabase() {
  const fallback = defaultDatabasePath({ userData: app.getPath("userData") });
  const choice = await dialog.showMessageBox({
    type: "question",
    buttons: [
      "Usar padrão",
      "Abrir banco existente",
      "Criar/selecionar arquivo",
      "Cancelar",
    ],
    defaultId: 0,
    cancelId: 3,
    title: "Banco de dados",
    message: "Escolha o banco SQLite do CRM",
  });
  if (choice.response === 3) return null;
  if (choice.response === 0) {
    const legacy = path.resolve(__dirname, "../database/crm.sqlite");
    if (shouldMigrateLegacy()) await migrateLegacyDatabase(legacy, fallback);
    return fallback;
  }
  const result =
    choice.response === 1
      ? await dialog.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "SQLite", extensions: ["sqlite", "db"] }],
        })
      : await dialog.showSaveDialog({
          defaultPath: fallback,
          properties: [],
          filters: [{ name: "SQLite", extensions: ["sqlite", "db"] }],
        });
  const selected = result.canceled
    ? null
    : result.filePath || result.filePaths?.[0];
  if (!selected) return null;
  if (choice.response === 2 && fs.existsSync(selected)) {
    dialog.showErrorBox(
      "Arquivo já existe",
      "Selecione um novo caminho; arquivos existentes não serão sobrescritos.",
    );
    return null;
  }
  try {
    return selectDatabasePath({ choice: "selected", selected });
  } catch (error) {
    dialog.showErrorBox("Banco inválido", error.message);
    return null;
  }
}

async function createWindow() {
  const projectDir = path.resolve(__dirname, "..");
  const databasePath = await chooseDatabase();
  if (!databasePath) {
    app.quit();
    return;
  }
  nextProcess = spawn(
    "npm",
    ["run", "start", "--", "--hostname", host, "--port", String(port)],
    {
      cwd: projectDir,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        HOSTNAME: host,
        PORT: String(port),
        SQLITE_PATH: databasePath,
      },
    },
  );

  try {
    await waitForServer(`http://${host}:${port}`);
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 900,
      minHeight: 600,
    });
    await mainWindow.loadURL(`http://${host}:${port}`);
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
app.on("before-quit", () => nextProcess?.kill());
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
