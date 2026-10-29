const fs = require("node:fs");
const path = require("node:path");
const sqlitePaths = require("../database/sqlite-paths.cjs");
const assetsPaths = require("./assets-paths.cjs");

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

  // Preferências como objeto: ausência, JSON corrompido ou valor não-objeto
  // valem `{}` (mesma tolerância do `savedDatabasePath` original).
  function readPreferences() {
    try {
      const parsed = JSON.parse(
        fileSystem.readFileSync(preferencesFile(), "utf8"),
      );
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  // Escrita atômica preservando os campos já existentes (ex.: marca de migração).
  function savePreferences(patch) {
    fileSystem.mkdirSync(app.getPath("userData"), { recursive: true });
    const destination = preferencesFile();
    const temporary = `${destination}.${process.pid}.tmp`;
    const next = { ...readPreferences(), ...patch };
    fileSystem.writeFileSync(temporary, JSON.stringify(next, null, 2));
    fileSystem.renameSync(temporary, destination);
  }

  function savedDatabasePath() {
    const databasePath = readPreferences().databasePath;
    return typeof databasePath === "string" && databasePath.trim()
      ? databasePath
      : null;
  }

  function saveDatabasePath(databasePath) {
    savePreferences({ databasePath });
  }

  // Qualquer valor que não seja `true` vale sidebar expandida.
  function savedSidebarCollapsed() {
    return readPreferences().sidebarCollapsed === true;
  }

  function saveSidebarCollapsed(collapsed) {
    if (typeof collapsed !== "boolean") {
      throw new TypeError("sidebarCollapsed deve ser booleano.");
    }
    savePreferences({ sidebarCollapsed: collapsed });
  }

  function handleGetSidebarCollapsed(event) {
    return trustedSender(event) ? savedSidebarCollapsed() : false;
  }

  function handleSetSidebarCollapsed(event, collapsed) {
    if (!trustedSender(event)) {
      return { ok: false, error: "Origem não autorizada." };
    }
    if (typeof collapsed !== "boolean") {
      return { ok: false, error: "Valor inválido." };
    }
    try {
      saveSidebarCollapsed(collapsed);
      return { ok: true };
    } catch {
      return { ok: false, error: "Não foi possível salvar a preferência." };
    }
  }

  function markLegacyAssetsMigrated(timestamp = new Date().toISOString()) {
    savePreferences({ legacyAssetsMigratedAt: timestamp });
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

  // Caminho da pasta de imagens exibido em Configurações (somente leitura, v1).
  function handleGetAssetsPath(event) {
    if (!trustedSender(event)) return null;
    const databasePath = savedDatabasePath();
    if (!databasePath) return null;
    return assetsPaths.assetsDirFor({
      databasePath,
      dataDir: app.getPath("userData"),
    });
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
    readPreferences,
    savePreferences,
    savedDatabasePath,
    saveDatabasePath,
    savedSidebarCollapsed,
    saveSidebarCollapsed,
    handleGetSidebarCollapsed,
    handleSetSidebarCollapsed,
    markLegacyAssetsMigrated,
    trustedSender,
    handleGetPath,
    handleGetAssetsPath,
    handleChoose,
    chooseDatabase,
  };
}

module.exports = { createDatabaseManager };
