import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isAllowedLogoName,
  readLogo,
  resolveAssetDirs,
  saveLogo,
} from "./logo-assets";

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

describe("resolveAssetDirs", () => {
  const cwdAssets = path.join(process.cwd(), "tmp", "assets");

  it("prioriza CRM_ASSETS_DIR e mantém os fallbacks na ordem, sem duplicatas", () => {
    const dirs = resolveAssetDirs({
      CRM_ASSETS_DIR: "/assets",
      CRM_DATA_DIR: "/data",
    });

    expect(dirs.write).toBe("/assets");
    expect(dirs.read).toEqual([
      "/assets",
      path.join("/data", "tmp", "assets"),
      cwdAssets,
    ]);
  });

  it("usa CRM_DATA_DIR/tmp/assets quando CRM_ASSETS_DIR está ausente", () => {
    const dirs = resolveAssetDirs({ CRM_DATA_DIR: "/data" });

    expect(dirs.write).toBe(path.join("/data", "tmp", "assets"));
    expect(dirs.read).toEqual([path.join("/data", "tmp", "assets"), cwdAssets]);
  });

  it("cai para process.cwd()/tmp/assets sem nenhuma variável", () => {
    const dirs = resolveAssetDirs({});

    expect(dirs.write).toBe(cwdAssets);
    expect(dirs.read).toEqual([cwdAssets]);
  });

  it("remove duplicatas quando CRM_ASSETS_DIR coincide com o legado", () => {
    const dirs = resolveAssetDirs({
      CRM_ASSETS_DIR: path.join("/data", "tmp", "assets"),
      CRM_DATA_DIR: "/data",
    });

    expect(dirs.read).toEqual([path.join("/data", "tmp", "assets"), cwdAssets]);
  });
});

describe("isAllowedLogoName", () => {
  it("aceita nomes UUID com extensões permitidas", () => {
    expect(isAllowedLogoName("a1b2c3.png")).toBe(true);
    expect(isAllowedLogoName("foto-do_cliente.jpg")).toBe(true);
    expect(isAllowedLogoName("12345.webp")).toBe(true);
  });

  it("rejeita path traversal, caixa alta e extensões proibidas", () => {
    expect(isAllowedLogoName("../secret.png")).toBe(false);
    expect(isAllowedLogoName("../../etc/passwd.png")).toBe(false);
    expect(isAllowedLogoName("/etc/passwd.png")).toBe(false);
    expect(isAllowedLogoName("logo.PNG")).toBe(false);
    expect(isAllowedLogoName("logo.gif")).toBe(false);
    expect(isAllowedLogoName("logo.png.exe")).toBe(false);
    expect(isAllowedLogoName("")).toBe(false);
  });
});

describe("saveLogo", () => {
  let tmpDir: string;
  let assetsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm-logo-assets-"));
    assetsDir = path.join(tmpDir, "assets");
    vi.stubEnv("CRM_ASSETS_DIR", assetsDir);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("cria o diretório e devolve URL com UUID e extensão", async () => {
    const logoPath = await saveLogo(PNG_BYTES, "png");

    expect(logoPath).toMatch(/^\/api\/logo\/[\w-]+\.png$/);
    const name = logoPath.split("/").pop()!;
    const written = path.join(assetsDir, name);
    expect(fs.existsSync(written)).toBe(true);
    expect(fs.readFileSync(written)).toEqual(Buffer.from(PNG_BYTES));
  });
});

describe("readLogo", () => {
  let tmpDir: string;
  let assetsDir: string;
  let legacyDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm-logo-assets-"));
    assetsDir = path.join(tmpDir, "assets");
    legacyDir = path.join(tmpDir, "data", "tmp", "assets");
    vi.stubEnv("CRM_ASSETS_DIR", assetsDir);
    vi.stubEnv("CRM_DATA_DIR", path.join(tmpDir, "data"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("lê do primeiro diretório que contém o arquivo", async () => {
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.mkdirSync(legacyDir, { recursive: true });
    const name = "logo.png";
    fs.writeFileSync(path.join(assetsDir, name), Buffer.from(PNG_BYTES));
    fs.writeFileSync(path.join(legacyDir, name), Buffer.from("legado"));

    const image = await readLogo(name);

    expect(image).toEqual(Buffer.from(PNG_BYTES));
  });

  it("cai para o diretório legado quando só ele tem o arquivo", async () => {
    fs.mkdirSync(legacyDir, { recursive: true });
    const name = "legado.png";
    fs.writeFileSync(path.join(legacyDir, name), Buffer.from(PNG_BYTES));

    const image = await readLogo(name);

    expect(image).toEqual(Buffer.from(PNG_BYTES));
  });

  it("retorna null para nome inválido", async () => {
    await expect(readLogo("../secret.png")).resolves.toBeNull();
  });

  it("retorna null para arquivo ausente", async () => {
    await expect(readLogo("nao-existe.png")).resolves.toBeNull();
  });
});
