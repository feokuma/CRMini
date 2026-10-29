import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  defaultAssetsDir,
  legacyAssetsDir,
  assetsDirFor,
  ensureAssetsDir,
  moveLegacyAssets,
} = require("../../electron/assets-paths.cjs") as {
  defaultAssetsDir: (databasePath?: string) => string | undefined;
  legacyAssetsDir: (dataDir: string) => string;
  assetsDirFor: (options: {
    databasePath?: string;
    dataDir: string;
  }) => string | undefined;
  ensureAssetsDir: (dir: string, options?: { fs?: typeof fs }) => void;
  moveLegacyAssets: (options: {
    legacyDir: string;
    destination: string;
    fs?: Partial<typeof fs>;
    logger?: { warn: (message: string) => void };
  }) => { moved: number; skipped: number; failed: number };
};

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "crm-assets-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

// `moveLegacyAssets` usa um subconjunto do `node:fs`; delega para o fs real e
// permite sobrescrever apenas o necessário por teste.
function fakeFs(overrides: Partial<typeof fs> = {}) {
  return {
    readdirSync: overrides.readdirSync ?? fs.readdirSync,
    mkdirSync: overrides.mkdirSync ?? fs.mkdirSync,
    existsSync: overrides.existsSync ?? fs.existsSync,
    renameSync: overrides.renameSync ?? fs.renameSync,
    copyFileSync: overrides.copyFileSync ?? fs.copyFileSync,
    unlinkSync: overrides.unlinkSync ?? fs.unlinkSync,
    rmdirSync: overrides.rmdirSync ?? fs.rmdirSync,
  } as typeof fs;
}

describe("derivação de caminhos", () => {
  it("deriva a pasta de assets do diretório do banco", () => {
    expect(defaultAssetsDir("/data/crm.sqlite")).toBe("/data/assets");
    expect(defaultAssetsDir("/data/sub/crm.sqlite")).toBe("/data/sub/assets");
  });

  it("resolve caminho relativo pela raiz do processo (SQLITE_PATH relativo)", () => {
    expect(defaultAssetsDir("database/crm.sqlite")).toBe(
      path.join(process.cwd(), "database", "assets"),
    );
  });

  it("retorna undefined para banco em memória ou caminho vazio", () => {
    expect(defaultAssetsDir(":memory:")).toBeUndefined();
    expect(defaultAssetsDir("")).toBeUndefined();
    expect(defaultAssetsDir(undefined)).toBeUndefined();
  });

  it("deriva o legado de dataDir/tmp/assets", () => {
    expect(legacyAssetsDir("/dados")).toBe("/dados/tmp/assets");
  });

  it("assetsDirFor usa o derivado do banco e cai no legado sem banco", () => {
    expect(
      assetsDirFor({ databasePath: "/data/crm.sqlite", dataDir: "/dados" }),
    ).toBe("/data/assets");
    expect(assetsDirFor({ databasePath: ":memory:", dataDir: "/dados" })).toBe(
      "/dados/tmp/assets",
    );
    expect(assetsDirFor({ databasePath: undefined, dataDir: "/dados" })).toBe(
      "/dados/tmp/assets",
    );
  });
});

describe("ensureAssetsDir", () => {
  it("cria a pasta recursivamente", () => {
    const dir = path.join(root, "a", "b", "assets");
    ensureAssetsDir(dir);
    expect(fs.statSync(dir).isDirectory()).toBe(true);
  });

  it("é tolerante a falha de criação", () => {
    // Pai é um arquivo: mkdirSync falha e a chamada não deve lançar.
    const file = path.join(root, "arquivo");
    fs.writeFileSync(file, "x");
    expect(() => ensureAssetsDir(path.join(file, "assets"))).not.toThrow();
  });
});

describe("moveLegacyAssets", () => {
  it("move arquivos suportados do legado para o destino", () => {
    const legacy = path.join(root, "legacy");
    const destination = path.join(root, "dest");
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, "a.png"), "1");
    fs.writeFileSync(path.join(legacy, "b.JPG"), "2");

    const result = moveLegacyAssets({ legacyDir: legacy, destination });

    expect(result).toEqual({ moved: 2, skipped: 0, failed: 0 });
    expect(fs.existsSync(path.join(destination, "a.png"))).toBe(true);
    expect(fs.existsSync(path.join(destination, "b.JPG"))).toBe(true);
    expect(fs.existsSync(path.join(legacy, "a.png"))).toBe(false);
    expect(fs.existsSync(path.join(legacy, "b.JPG"))).toBe(false);
  });

  it("não sobrescreve destino existente e mantém a origem", () => {
    const legacy = path.join(root, "legacy");
    const destination = path.join(root, "dest");
    fs.mkdirSync(legacy, { recursive: true });
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(legacy, "a.png"), "origem");
    fs.writeFileSync(path.join(destination, "a.png"), "destino");

    const result = moveLegacyAssets({ legacyDir: legacy, destination });

    expect(result).toEqual({ moved: 0, skipped: 1, failed: 0 });
    expect(fs.readFileSync(path.join(destination, "a.png"), "utf8")).toBe(
      "destino",
    );
    expect(fs.readFileSync(path.join(legacy, "a.png"), "utf8")).toBe("origem");
  });

  it("mantém a origem e avisa no logger quando o movimento falha", () => {
    const legacy = path.join(root, "legacy");
    const destination = path.join(root, "dest");
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, "a.png"), "1");
    fs.writeFileSync(path.join(legacy, "b.png"), "2");
    const warn = vi.fn();
    const fileSystem = fakeFs({
      renameSync: (source, target) => {
        if (String(source).endsWith("b.png")) throw new Error("permissão");
        return fs.renameSync(source, target);
      },
    });

    const result = moveLegacyAssets({
      legacyDir: legacy,
      destination,
      fs: fileSystem,
      logger: { warn },
    });

    expect(result).toEqual({ moved: 1, skipped: 0, failed: 1 });
    expect(fs.existsSync(path.join(destination, "a.png"))).toBe(true);
    expect(fs.existsSync(path.join(legacy, "b.png"))).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("cai em cópia + remoção quando rename falha com EXDEV", () => {
    const legacy = path.join(root, "legacy");
    const destination = path.join(root, "dest");
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, "a.png"), "1");
    const copyFileSync = vi.fn((source, target) =>
      fs.copyFileSync(source, target),
    );
    const unlinkSync = vi.fn((target) => fs.unlinkSync(target));
    const fileSystem = fakeFs({
      renameSync: () => {
        throw Object.assign(new Error("cross-device"), { code: "EXDEV" });
      },
      copyFileSync,
      unlinkSync,
    });

    const result = moveLegacyAssets({
      legacyDir: legacy,
      destination,
      fs: fileSystem,
    });

    expect(result).toEqual({ moved: 1, skipped: 0, failed: 0 });
    expect(copyFileSync).toHaveBeenCalledTimes(1);
    expect(unlinkSync).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(destination, "a.png"))).toBe(true);
    expect(fs.existsSync(path.join(legacy, "a.png"))).toBe(false);
  });

  it("mantém a origem quando a cópia de EXDEV falha", () => {
    const legacy = path.join(root, "legacy");
    const destination = path.join(root, "dest");
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, "a.png"), "1");
    const warn = vi.fn();
    const fileSystem = fakeFs({
      renameSync: () => {
        throw Object.assign(new Error("cross-device"), { code: "EXDEV" });
      },
      copyFileSync: () => {
        throw new Error("disco cheio");
      },
    });

    const result = moveLegacyAssets({
      legacyDir: legacy,
      destination,
      fs: fileSystem,
      logger: { warn },
    });

    expect(result).toEqual({ moved: 0, skipped: 0, failed: 1 });
    expect(fs.existsSync(path.join(legacy, "a.png"))).toBe(true);
    expect(fs.existsSync(path.join(destination, "a.png"))).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("é idempotente: a segunda chamada não move nada", () => {
    const legacy = path.join(root, "legacy");
    const destination = path.join(root, "dest");
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, "a.png"), "1");

    moveLegacyAssets({ legacyDir: legacy, destination });
    const second = moveLegacyAssets({ legacyDir: legacy, destination });

    expect(second).toEqual({ moved: 0, skipped: 0, failed: 0 });
  });

  it("remove o diretório legado quando fica vazio", () => {
    const legacy = path.join(root, "legacy");
    const destination = path.join(root, "dest");
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, "a.png"), "1");

    moveLegacyAssets({ legacyDir: legacy, destination });

    expect(fs.existsSync(legacy)).toBe(false);
  });

  it("ignora diretório legado inexistente", () => {
    const result = moveLegacyAssets({
      legacyDir: path.join(root, "nada"),
      destination: path.join(root, "dest"),
    });

    expect(result).toEqual({ moved: 0, skipped: 0, failed: 0 });
  });

  it("ignora extensões não suportadas e subdiretórios", () => {
    const legacy = path.join(root, "legacy");
    const destination = path.join(root, "dest");
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, "a.txt"), "1");
    fs.writeFileSync(path.join(legacy, "a.png"), "2");
    fs.mkdirSync(path.join(legacy, "subdir"));

    const result = moveLegacyAssets({ legacyDir: legacy, destination });

    expect(result).toEqual({ moved: 1, skipped: 0, failed: 0 });
    expect(fs.existsSync(path.join(legacy, "a.txt"))).toBe(true);
    expect(fs.existsSync(path.join(legacy, "subdir"))).toBe(true);
  });

  it("não faz nada quando legado e destino são o mesmo caminho", () => {
    const dir = path.join(root, "same");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "a.png"), "1");

    const result = moveLegacyAssets({ legacyDir: dir, destination: dir });

    expect(result).toEqual({ moved: 0, skipped: 0, failed: 0 });
    expect(fs.existsSync(path.join(dir, "a.png"))).toBe(true);
  });
});
