import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createDatabaseManager } = require("../../electron/database-manager.cjs");
const sqlitePaths = require("../../database/sqlite-paths.cjs") as {
  defaultDatabasePath: (options?: { userData?: string }) => string;
  validateDatabase: (file: string) => string;
  migrateLegacyDatabase: (
    legacy: string,
    destination: string,
  ) => Promise<boolean>;
  selectDatabasePath: (options: {
    choice: string;
    fallback?: string;
    selected?: string;
  }) => string | null;
  shouldMigrateLegacy: (env?: NodeJS.ProcessEnv) => boolean;
};
const Database = require("better-sqlite3") as typeof import("better-sqlite3");

type Manager = {
  preferencesFile: () => string;
  readPreferences: () => Record<string, unknown>;
  savePreferences: (patch: Record<string, unknown>) => void;
  savedDatabasePath: () => string | null;
  saveDatabasePath: (file: string) => void;
  markLegacyAssetsMigrated: (timestamp?: string) => void;
  trustedSender: (event: unknown) => boolean;
  handleGetPath: (event: unknown) => string | null;
  handleGetAssetsPath: (event: unknown) => string | null;
  handleChoose: (event: unknown) => Promise<{
    ok: boolean;
    canceled?: boolean;
    restarting?: boolean;
    unchanged?: boolean;
    error?: string;
  }>;
  chooseDatabase: () => Promise<string | null>;
};

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "crm-electron-test-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function createCrmDatabase(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.exec(
    "CREATE TABLE clients(id); CREATE TABLE contacts(id); CREATE TABLE opportunities(id); CREATE TABLE tasks(id);",
  );
  db.close();
  return file;
}

function createForeignKeyOnlyDatabase(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.exec("CREATE TABLE unrelated(id)");
  db.close();
  return file;
}

function setup({
  paths = {
    ...sqlitePaths,
    shouldMigrateLegacy: () => false,
  },
  legacyDatabasePath = path.join(root, "legacy", "crm.sqlite"),
  getServerUrl,
}: {
  paths?: typeof sqlitePaths;
  legacyDatabasePath?: string;
  getServerUrl?: () => string | undefined;
} = {}) {
  const userData = path.join(root, "userData");
  const app = {
    getPath: vi.fn(() => userData),
    relaunch: vi.fn(),
    quit: vi.fn(),
  };
  const dialog = {
    showMessageBox: vi.fn(),
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showErrorBox: vi.fn(),
  };
  const mainWindow = { id: 1 };
  const manager = createDatabaseManager({
    app,
    dialog,
    getMainWindow: () => mainWindow,
    paths,
    legacyDatabasePath,
    getServerUrl,
  }) as Manager;
  return {
    app,
    dialog,
    manager,
    mainWindow,
    userData,
    preferences: path.join(userData, "preferences.json"),
  };
}

function writePreferences(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

const trustedEvent = {
  senderFrame: { url: "http://127.0.0.1:3174/configuracoes" },
};

describe("inicialização do Electron e persistência do banco", () => {
  it("oferece as opções na primeira inicialização e encerra ao cancelar", async () => {
    const { dialog, manager } = setup();
    dialog.showMessageBox.mockResolvedValue({ response: 3 });

    await expect(manager.chooseDatabase()).resolves.toBeNull();

    expect(dialog.showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({
        buttons: [
          "Usar padrão",
          "Abrir banco existente",
          "Criar/selecionar arquivo",
          "Cancelar",
        ],
        defaultId: 0,
        cancelId: 3,
      }),
    );
    expect(dialog.showOpenDialog).not.toHaveBeenCalled();
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
  });

  it("usa o banco padrão em userData e migra o banco legado quando aplicável", async () => {
    const legacy = createCrmDatabase(path.join(root, "legacy", "crm.sqlite"));
    const { app, dialog, manager } = setup({
      paths: { ...sqlitePaths, shouldMigrateLegacy: () => true },
      legacyDatabasePath: legacy,
    });
    dialog.showMessageBox.mockResolvedValue({ response: 0 });

    const selected = await manager.chooseDatabase();

    const expected = path.join(app.getPath("userData"), "crm.sqlite");
    expect(selected).toBe(expected);
    expect(fs.existsSync(expected)).toBe(true);
    expect(sqlitePaths.validateDatabase(expected)).toBe("crm");
    expect(dialog.showOpenDialog).not.toHaveBeenCalled();
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
  });

  it("abre um banco existente válido sem migrar nem criar outro arquivo", async () => {
    const existing = createCrmDatabase(path.join(root, "existing", "crm.sqlite"));
    const { dialog, manager } = setup();
    dialog.showMessageBox.mockResolvedValue({ response: 1 });
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [existing],
    });

    await expect(manager.chooseDatabase()).resolves.toBe(existing);

    expect(dialog.showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({ properties: ["openFile"] }),
    );
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
    expect(dialog.showErrorBox).not.toHaveBeenCalled();
  });

  it("trata cancelamento do seletor de banco existente", async () => {
    const { dialog, manager } = setup();
    dialog.showMessageBox.mockResolvedValue({ response: 1 });
    dialog.showOpenDialog.mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    await expect(manager.chooseDatabase()).resolves.toBeNull();
    expect(dialog.showErrorBox).not.toHaveBeenCalled();
  });

  it("cria um novo arquivo de banco em caminho ainda inexistente", async () => {
    const { dialog, manager } = setup();
    const newFile = path.join(root, "new", "crm.sqlite");
    dialog.showMessageBox.mockResolvedValue({ response: 2 });
    dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: newFile,
    });

    await expect(manager.chooseDatabase()).resolves.toBe(newFile);

    expect(dialog.showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: expect.stringContaining("crm.sqlite") }),
    );
    expect(fs.existsSync(newFile)).toBe(false);
  });

  it("não sobrescreve arquivo existente ao criar/selecionar", async () => {
    const existing = createCrmDatabase(path.join(root, "existing", "crm.sqlite"));
    const { dialog, manager } = setup();
    dialog.showMessageBox.mockResolvedValue({ response: 2 });
    dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: existing,
    });

    await expect(manager.chooseDatabase()).resolves.toBeNull();

    expect(dialog.showErrorBox).toHaveBeenCalledWith(
      "Arquivo já existe",
      expect.stringMatching(/não serão sobrescritos/),
    );
    expect(sqlitePaths.validateDatabase(existing)).toBe("crm");
  });

  it("trata cancelamento do seletor de criação", async () => {
    const { dialog, manager } = setup();
    dialog.showMessageBox.mockResolvedValue({ response: 2 });
    dialog.showSaveDialog.mockResolvedValue({
      canceled: true,
      filePath: path.join(root, "new.sqlite"),
    });

    await expect(manager.chooseDatabase()).resolves.toBeNull();
    expect(dialog.showErrorBox).not.toHaveBeenCalled();
  });

  it("rejeita um arquivo selecionado que não é banco do CRM", async () => {
    const invalid = createForeignKeyOnlyDatabase(
      path.join(root, "invalid", "crm.sqlite"),
    );
    const { dialog, manager } = setup();
    dialog.showMessageBox.mockResolvedValue({ response: 1 });
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [invalid],
    });

    await expect(manager.chooseDatabase()).resolves.toBeNull();

    expect(dialog.showErrorBox).toHaveBeenCalledWith(
      "Banco inválido",
      expect.stringMatching(/CRM/),
    );
  });

  it("reutiliza o caminho persistido sem abrir o diálogo de primeira escolha", async () => {
    const saved = createCrmDatabase(path.join(root, "saved", "crm.sqlite"));
    const { dialog, manager, preferences } = setup();
    writePreferences(preferences, { databasePath: saved });

    await expect(manager.chooseDatabase()).resolves.toBe(saved);

    expect(dialog.showMessageBox).not.toHaveBeenCalled();
    expect(dialog.showOpenDialog).not.toHaveBeenCalled();
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
  });

  it("recupera caminho persistido ausente por seleção explícita válida", async () => {
    const missing = path.join(root, "missing", "crm.sqlite");
    const replacement = createCrmDatabase(path.join(root, "replacement.sqlite"));
    const { dialog, manager, preferences } = setup();
    writePreferences(preferences, { databasePath: missing });
    dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [replacement] });

    await expect(manager.chooseDatabase()).resolves.toBe(replacement);

    expect(fs.existsSync(missing)).toBe(false);
    expect(manager.savedDatabasePath()).toBe(missing);
    expect(dialog.showErrorBox).toHaveBeenCalledWith("Banco configurado indisponível", expect.stringMatching(/preferência atual será preservada/));
  });

  it("falha ao iniciar quando o caminho persistido aponta para banco inválido", async () => {
    const invalid = createForeignKeyOnlyDatabase(
      path.join(root, "invalid", "crm.sqlite"),
    );
    const { dialog, manager, preferences } = setup();
    writePreferences(preferences, { databasePath: invalid });

    dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    await expect(manager.chooseDatabase()).resolves.toBeNull();
    expect(manager.savedDatabasePath()).toBe(invalid);
    expect(dialog.showErrorBox).toHaveBeenCalledWith("Banco configurado indisponível", expect.stringMatching(/CRM/));
  });

  it.each([null, 42, "", "   "]) ("ignora databasePath inválido (%s)", async (databasePath) => {
    const { dialog, manager, preferences } = setup();
    writePreferences(preferences, { databasePath });
    dialog.showMessageBox.mockResolvedValue({ response: 3 });
    await expect(manager.chooseDatabase()).resolves.toBeNull();
    expect(dialog.showMessageBox).toHaveBeenCalledOnce();
  });

  it("encerra recuperação cancelada sem alterar preferência", async () => {
    const { dialog, manager, preferences } = setup();
    writePreferences(preferences, { databasePath: path.join(root, "missing.sqlite") });
    dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    await expect(manager.chooseDatabase()).resolves.toBeNull();
    expect(manager.savedDatabasePath()).toBe(path.join(root, "missing.sqlite"));
  });

  it("ignora preferências ilegíveis e volta ao fluxo de primeira escolha", async () => {
    const { dialog, manager, preferences } = setup();
    fs.mkdirSync(path.dirname(preferences), { recursive: true });
    fs.writeFileSync(preferences, "{not-json");
    dialog.showMessageBox.mockResolvedValue({ response: 3 });

    await expect(manager.chooseDatabase()).resolves.toBeNull();

    expect(dialog.showMessageBox).toHaveBeenCalledTimes(1);
    expect(manager.savedDatabasePath()).toBeNull();
  });

  it("grava e substitui o caminho persistido em preferences.json", () => {
    const { manager, preferences } = setup();

    manager.saveDatabasePath("/data/first.sqlite");
    expect(JSON.parse(fs.readFileSync(preferences, "utf8"))).toEqual({
      databasePath: "/data/first.sqlite",
    });

    manager.saveDatabasePath("/data/second.sqlite");
    expect(JSON.parse(fs.readFileSync(preferences, "utf8"))).toEqual({
      databasePath: "/data/second.sqlite",
    });
  });
});

describe("troca de banco pelo IPC", () => {
  it("valida o caminho, persiste a escolha e reinicia o aplicativo", async () => {
    const selected = createCrmDatabase(path.join(root, "new", "crm.sqlite"));
    const { app, dialog, manager, preferences } = setup();
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [selected],
    });

    await expect(manager.handleChoose(trustedEvent)).resolves.toEqual({
      ok: true,
      restarting: true,
    });

    expect(JSON.parse(fs.readFileSync(preferences, "utf8"))).toEqual({
      databasePath: selected,
    });
    expect(app.relaunch).toHaveBeenCalledTimes(1);
    expect(app.quit).toHaveBeenCalledTimes(1);
  });

  it("retorna cancelamento sem persistir ou reiniciar", async () => {
    const { app, dialog, manager, preferences } = setup();
    dialog.showOpenDialog.mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    await expect(manager.handleChoose(trustedEvent)).resolves.toEqual({
      ok: false,
      canceled: true,
    });

    expect(fs.existsSync(preferences)).toBe(false);
    expect(app.relaunch).not.toHaveBeenCalled();
    expect(app.quit).not.toHaveBeenCalled();
  });

  it("informa banco inválido sem persistir nem reiniciar", async () => {
    const invalid = createForeignKeyOnlyDatabase(
      path.join(root, "invalid", "crm.sqlite"),
    );
    const { app, dialog, manager, preferences } = setup();
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [invalid],
    });

    const result = await manager.handleChoose(trustedEvent);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/CRM/);
    expect(fs.existsSync(preferences)).toBe(false);
    expect(app.relaunch).not.toHaveBeenCalled();
    expect(app.quit).not.toHaveBeenCalled();
  });

  it("não reinicia quando o caminho escolhido é o mesmo já configurado", async () => {
    const current = createCrmDatabase(path.join(root, "current", "crm.sqlite"));
    const { app, dialog, manager, preferences } = setup();
    writePreferences(preferences, { databasePath: current });
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [current],
    });

    await expect(manager.handleChoose(trustedEvent)).resolves.toEqual({
      ok: true,
      unchanged: true,
    });

    expect(app.relaunch).not.toHaveBeenCalled();
    expect(app.quit).not.toHaveBeenCalled();
  });
});

describe("segurança da ponte IPC", () => {
  it("aceita apenas a origem exata do servidor local", () => {
    const { manager } = setup();

    expect(manager.trustedSender(trustedEvent)).toBe(true);
    expect(
      manager.trustedSender({
        senderFrame: { url: "http://127.0.0.1:3174/" },
      }),
    ).toBe(true);
    expect(
      manager.trustedSender({
        senderFrame: { url: "http://127.0.0.1:3175/configuracoes" },
      }),
    ).toBe(false);
    expect(
      manager.trustedSender({
        senderFrame: { url: "https://127.0.0.1:3174/configuracoes" },
      }),
    ).toBe(false);
    expect(
      manager.trustedSender({
        senderFrame: {
          url: "http://127.0.0.1:3174.evil.example/configuracoes",
        },
      }),
    ).toBe(false);
    expect(
      manager.trustedSender({
        senderFrame: { url: "http://localhost:3174/configuracoes" },
      }),
    ).toBe(false);
    expect(manager.trustedSender({ senderFrame: undefined })).toBe(false);
    expect(manager.trustedSender({})).toBe(false);
  });

  it("autoriza a origem dinâmica real do servidor e rejeita a porta anterior", async () => {
    const selected = createCrmDatabase(path.join(root, "dynamic.sqlite"));
    const getServerUrl = vi.fn(() => "http://127.0.0.1:43821");
    const { manager, dialog } = setup({ getServerUrl });
    const dynamic = { senderFrame: { url: "http://127.0.0.1:43821/configuracoes" } };
    dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [selected] });

    expect(manager.trustedSender(dynamic)).toBe(true);
    await expect(manager.handleChoose(dynamic)).resolves.toMatchObject({ ok: true });
    expect(manager.trustedSender(trustedEvent)).toBe(false);
    expect(getServerUrl).toHaveBeenCalled();
  });

  it("não expõe o caminho configurado para origem não confiável", async () => {
    const saved = createCrmDatabase(path.join(root, "saved", "crm.sqlite"));
    const { manager, preferences } = setup();
    writePreferences(preferences, { databasePath: saved });

    expect(manager.handleGetPath(trustedEvent)).toBe(saved);
    expect(
      manager.handleGetPath({
        senderFrame: { url: "http://127.0.0.1:3174.evil.example/" },
      }),
    ).toBeNull();
  });

  it("rejeita troca de banco de origem não confiável antes de abrir diálogo", async () => {
    const { app, dialog, manager, preferences } = setup();

    await expect(
      manager.handleChoose({
        senderFrame: { url: "http://127.0.0.1:9999/configuracoes" },
      }),
    ).resolves.toEqual({ ok: false, error: "Origem não autorizada." });

    expect(dialog.showOpenDialog).not.toHaveBeenCalled();
    expect(fs.existsSync(preferences)).toBe(false);
    expect(app.relaunch).not.toHaveBeenCalled();
  });
});

describe("preferências como objeto e pasta de imagens", () => {
  it("readPreferences retorna {} quando o arquivo não existe", () => {
    const { manager } = setup();
    expect(manager.readPreferences()).toEqual({});
  });

  it("readPreferences tolera JSON corrompido e valor não-objeto", () => {
    const { manager, preferences } = setup();

    fs.mkdirSync(path.dirname(preferences), { recursive: true });
    fs.writeFileSync(preferences, "{not-json");
    expect(manager.readPreferences()).toEqual({});

    fs.writeFileSync(preferences, "42");
    expect(manager.readPreferences()).toEqual({});
  });

  it("saveDatabasePath preserva outros campos das preferências", () => {
    const { manager, preferences } = setup();
    writePreferences(preferences, {
      databasePath: "/data/a.sqlite",
      legacyAssetsMigratedAt: "2026-10-29T00:00:00.000Z",
    });

    manager.saveDatabasePath("/data/b.sqlite");

    expect(JSON.parse(fs.readFileSync(preferences, "utf8"))).toEqual({
      databasePath: "/data/b.sqlite",
      legacyAssetsMigratedAt: "2026-10-29T00:00:00.000Z",
    });
  });

  it("markLegacyAssetsMigrated grava o timestamp ISO", () => {
    const { manager, preferences } = setup();
    manager.saveDatabasePath("/data/crm.sqlite");

    manager.markLegacyAssetsMigrated("2026-10-29T01:02:03.000Z");

    expect(JSON.parse(fs.readFileSync(preferences, "utf8"))).toEqual({
      databasePath: "/data/crm.sqlite",
      legacyAssetsMigratedAt: "2026-10-29T01:02:03.000Z",
    });
  });

  it("handleGetAssetsPath deriva a pasta de assets do banco salvo", () => {
    const saved = createCrmDatabase(path.join(root, "saved", "crm.sqlite"));
    const { manager, preferences } = setup();
    writePreferences(preferences, { databasePath: saved });

    expect(manager.handleGetAssetsPath(trustedEvent)).toBe(
      path.join(root, "saved", "assets"),
    );
  });

  it("handleGetAssetsPath retorna null sem banco salvo", () => {
    const { manager } = setup();
    expect(manager.handleGetAssetsPath(trustedEvent)).toBeNull();
  });

  it("handleGetAssetsPath retorna null para origem não confiável", () => {
    const saved = createCrmDatabase(path.join(root, "saved", "crm.sqlite"));
    const { manager, preferences } = setup();
    writePreferences(preferences, { databasePath: saved });

    expect(
      manager.handleGetAssetsPath({
        senderFrame: { url: "http://127.0.0.1:9999/configuracoes" },
      }),
    ).toBeNull();
  });
});
