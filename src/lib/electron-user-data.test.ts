import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { legacyUserDataDir, migrateLegacyUserData } =
  require("../../electron/user-data.cjs") as {
    legacyUserDataDir: (appDataDir: string) => string;
    migrateLegacyUserData: (options: {
      appDataDir: string;
      userDataDir: string;
      fs?: typeof fs;
      logger?: { warn: (message: string) => void };
    }) => {
      migrated: boolean;
      reason: string;
      error?: unknown;
    };
  };

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "crm-userdata-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

// `migrateLegacyUserData` usa um subconjunto do `node:fs`; delega para o fs real
// e permite sobrescrever apenas o necessário por teste.
function fakeFs(overrides: Partial<typeof fs> = {}) {
  return { ...fs, ...overrides };
}

// Cria a pasta legada com o mesmo conteúdo que um usuário antigo teria.
function seedLegacy(appDataDir: string) {
  const legacy = legacyUserDataDir(appDataDir);
  fs.mkdirSync(path.join(legacy, "tmp", "assets"), { recursive: true });
  fs.writeFileSync(path.join(legacy, "preferences.json"), "{}");
  fs.writeFileSync(path.join(legacy, "crm.sqlite"), "sqlite");
  fs.writeFileSync(path.join(legacy, "tmp", "assets", "logo.png"), "logo");
  return legacy;
}

describe("legacyUserDataDir", () => {
  it("aponta para appData/crmini", () => {
    expect(legacyUserDataDir("/dados")).toBe(path.join("/dados", "crmini"));
  });
});

describe("migrateLegacyUserData", () => {
  it("não faz nada quando a pasta legada já é o userData (same)", () => {
    const appDataDir = root;
    const userDataDir = legacyUserDataDir(appDataDir);
    const warn = vi.fn();

    const result = migrateLegacyUserData({
      appDataDir,
      userDataDir,
      logger: { warn },
    });

    expect(result).toEqual({ migrated: false, reason: "same" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("trata como same quando as duas grafias apontam para a mesma pasta (FS case-insensitive)", () => {
    const appDataDir = root;
    const userDataDir = path.join(appDataDir, "CRMini");
    seedLegacy(appDataDir);
    const renameSync = vi.fn();
    // Simula Windows/macOS: `crmini` e `CRMini` resolvem para o mesmo caminho.
    const fileSystem = fakeFs({
      existsSync: () => true,
      realpathSync: () => path.join(appDataDir, "CRMini"),
      readdirSync: () => ["preferences.json"],
      renameSync,
    });

    const result = migrateLegacyUserData({
      appDataDir,
      userDataDir,
      fs: fileSystem,
    });

    expect(result).toEqual({ migrated: false, reason: "same" });
    expect(renameSync).not.toHaveBeenCalled();
  });

  it("trata instalação nova sem legado como fresh", () => {
    const result = migrateLegacyUserData({
      appDataDir: root,
      userDataDir: path.join(root, "CRMini"),
    });

    expect(result).toEqual({ migrated: false, reason: "fresh" });
    expect(fs.existsSync(path.join(root, "CRMini"))).toBe(false);
  });

  it("renomeia o legado para o userData e remove a pasta antiga (renamed)", () => {
    const appDataDir = root;
    const userDataDir = path.join(root, "CRMini");
    const legacy = seedLegacy(appDataDir);

    const result = migrateLegacyUserData({ appDataDir, userDataDir });

    expect(result).toEqual({ migrated: true, reason: "renamed" });
    expect(fs.existsSync(legacy)).toBe(false);
    expect(
      fs.readFileSync(path.join(userDataDir, "preferences.json"), "utf8"),
    ).toBe("{}");
    expect(fs.readFileSync(path.join(userDataDir, "crm.sqlite"), "utf8")).toBe(
      "sqlite",
    );
    expect(
      fs.readFileSync(
        path.join(userDataDir, "tmp", "assets", "logo.png"),
        "utf8",
      ),
    ).toBe("logo");
  });

  it("não move nada quando as duas pastas têm conteúdo (both) e avisa no logger", () => {
    const appDataDir = root;
    const userDataDir = path.join(root, "CRMini");
    const legacy = seedLegacy(appDataDir);
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(path.join(userDataDir, "novo.json"), "x");
    const warn = vi.fn();

    const result = migrateLegacyUserData({
      appDataDir,
      userDataDir,
      logger: { warn },
    });

    expect(result).toEqual({ migrated: false, reason: "both" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(legacy, "preferences.json"))).toBe(true);
    expect(fs.existsSync(path.join(userDataDir, "novo.json"))).toBe(true);
    expect(fs.existsSync(path.join(userDataDir, "preferences.json"))).toBe(
      false,
    );
  });

  it("renomeia o legado quando o userData existe mas está vazio", () => {
    const appDataDir = root;
    const userDataDir = path.join(root, "CRMini");
    const legacy = seedLegacy(appDataDir);
    fs.mkdirSync(userDataDir, { recursive: true });

    const result = migrateLegacyUserData({ appDataDir, userDataDir });

    expect(result).toEqual({ migrated: true, reason: "renamed" });
    expect(fs.existsSync(legacy)).toBe(false);
    expect(fs.existsSync(path.join(userDataDir, "crm.sqlite"))).toBe(true);
  });

  it("copia o conteúdo quando rename falha com EXDEV, preservando o legado", () => {
    const appDataDir = root;
    const userDataDir = path.join(root, "CRMini");
    const legacy = seedLegacy(appDataDir);
    const warn = vi.fn();
    const fileSystem = fakeFs({
      renameSync: () => {
        throw Object.assign(new Error("cross-device"), { code: "EXDEV" });
      },
    });

    const result = migrateLegacyUserData({
      appDataDir,
      userDataDir,
      fs: fileSystem,
      logger: { warn },
    });

    expect(result).toEqual({ migrated: true, reason: "copied" });
    expect(warn).toHaveBeenCalledTimes(1);
    // Conteúdo copiado do outro lado e legado intacto.
    expect(
      fs.readFileSync(path.join(userDataDir, "preferences.json"), "utf8"),
    ).toBe("{}");
    expect(
      fs.readFileSync(
        path.join(userDataDir, "tmp", "assets", "logo.png"),
        "utf8",
      ),
    ).toBe("logo");
    expect(fs.existsSync(path.join(legacy, "crm.sqlite"))).toBe(true);
  });

  it("falha sem lançar quando a cópia quebra, mantendo o legado e limpando o parcial", () => {
    const appDataDir = root;
    const userDataDir = path.join(root, "CRMini");
    const legacy = seedLegacy(appDataDir);
    const fileSystem = fakeFs({
      renameSync: () => {
        throw Object.assign(new Error("cross-device"), { code: "EXDEV" });
      },
      copyFileSync: () => {
        throw new Error("disco cheio");
      },
    });

    const result = migrateLegacyUserData({
      appDataDir,
      userDataDir,
      fs: fileSystem,
    });

    expect(result).toEqual({
      migrated: false,
      reason: "failed",
      error: expect.objectContaining({ message: "disco cheio" }),
    });
    expect(fs.existsSync(path.join(legacy, "crm.sqlite"))).toBe(true);
    expect(fs.existsSync(userDataDir)).toBe(false);
  });

  it("nunca lança, mesmo com a cópia e a limpeza falhando", () => {
    const appDataDir = root;
    const userDataDir = path.join(root, "CRMini");
    seedLegacy(appDataDir);
    const fileSystem = fakeFs({
      renameSync: () => {
        throw Object.assign(new Error("cross-device"), { code: "EXDEV" });
      },
      copyFileSync: () => {
        throw new Error("io");
      },
      rmSync: () => {
        throw new Error("io");
      },
    });

    expect(() =>
      migrateLegacyUserData({
        appDataDir,
        userDataDir,
        fs: fileSystem,
      }),
    ).not.toThrow();
  });
});
