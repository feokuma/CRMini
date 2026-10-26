const fs = require("node:fs");
const path = require("node:path");
const sqlitePaths = require("../database/sqlite-paths.cjs");

const host = "127.0.0.1";
const port = 3174;

function createDatabaseManager({
  app,
  dialog,
  getMainWindow = () => undefined,
  beforeRestart = async () => {},
  getServerUrl = () => `http://${serverHost}:${serverPort}`,
  fs: fileSystem = fs,
  path: pathModule = path,
  paths = sqlitePaths,
  host: serverHost = host,
  port: serverPort = port,
  legacyDatabasePath = path.resolve(__dirname, "../database/crm.sqlite"),
}) {
  const preferencesFile = () =>
    pathModule.join(app.getPath("userData"), "preferences.json");

  function savedDatabasePath() {
    try {
      const databasePath = JSON.parse(fileSystem.readFileSync(preferencesFile(), "utf8")).databasePath;
      return typeof databasePath === "string" && databasePath.trim() ? databasePath : null;
    } catch {
      return null;
    }
  }

  function saveDatabasePath(databasePath) {
    fileSystem.mkdirSync(app.getPath("userData"), { recursive: true });
    const destination = preferencesFile();
    const temporary = `${destination}.${process.pid}.tmp`;
    fileSystem.writeFileSync(temporary, JSON.stringify({ databasePath }, null, 2));
    fileSystem.renameSync(temporary, destination);
  }

  function trustedSender(event) {
    try {
      const expected = new URL(getServerUrl());
      const actual = new URL(event.senderFrame?.url);
      return actual.origin === expected.origin && actual.username === "" && actual.password === "";
    } catch {
      return false;
    }
  }

  function handleGetPath(event) {
    return trustedSender(event) ? savedDatabasePath() : null;
  }

  async function handleChoose(event) {
    if (!trustedSender(event)) {
      return { ok: false, error: "Origem não autorizada." };
    }
    const current = savedDatabasePath();
    const result = await dialog.showOpenDialog(getMainWindow(), {
      properties: ["openFile"],
      filters: [{ name: "SQLite", extensions: ["sqlite", "db"] }],
    });
    if (result.canceled || !result.filePaths[0]) {
      return { ok: false, canceled: true };
    }
    try {
      paths.validateDatabase(result.filePaths[0]);
      if (result.filePaths[0] === current) return { ok: true, unchanged: true };
      await beforeRestart();
      saveDatabasePath(result.filePaths[0]);
      app.relaunch();
      app.quit();
      return { ok: true, restarting: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function chooseDatabase() {
    const saved = savedDatabasePath();
    if (saved) {
      try {
        if (!fileSystem.existsSync(saved)) throw new Error("o arquivo não foi encontrado");
        paths.validateDatabase(saved);
        return saved;
      } catch (error) {
        dialog.showErrorBox("Banco configurado indisponível", `Não foi possível abrir o banco salvo (${saved}): ${error.message}\nSelecione um banco válido para recuperar a inicialização. A preferência atual será preservada até uma nova escolha válida.`);
        const recovered = await dialog.showOpenDialog({
          properties: ["openFile"], filters: [{ name: "SQLite", extensions: ["sqlite", "db"] }],
        });
        const selected = recovered.canceled ? null : recovered.filePaths?.[0];
        if (!selected) return null;
        try {
          paths.validateDatabase(selected);
          return selected;
        } catch (validationError) {
          dialog.showErrorBox("Banco inválido", validationError.message);
          return null;
        }
      }
    }
    const fallback = paths.defaultDatabasePath({
      userData: app.getPath("userData"),
    });
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
      if (paths.shouldMigrateLegacy()) {
        await paths.migrateLegacyDatabase(legacyDatabasePath, fallback);
      }
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
    if (choice.response === 2 && fileSystem.existsSync(selected)) {
      dialog.showErrorBox(
        "Arquivo já existe",
        "Selecione um novo caminho; arquivos existentes não serão sobrescritos.",
      );
      return null;
    }
    try {
      return paths.selectDatabasePath({ choice: "selected", selected });
    } catch (error) {
      dialog.showErrorBox("Banco inválido", error.message);
      return null;
    }
  }

  return {
    preferencesFile,
    savedDatabasePath,
    saveDatabasePath,
    trustedSender,
    handleGetPath,
    handleChoose,
    chooseDatabase,
  };
}

module.exports = { createDatabaseManager };
