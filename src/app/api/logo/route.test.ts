// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { GET } from "./[name]/route";

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm-logo-"));
  vi.stubEnv("CRM_DATA_DIR", dataDir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

function postRequest(file: { name: string; type: string; content: Uint8Array }) {
  const form = new FormData();
  form.append("file", new File([file.content], file.name, { type: file.type }));
  return new NextRequest("http://localhost/api/logo", {
    method: "POST",
    body: form,
  });
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("POST /api/logo", () => {
  it("grava o arquivo em CRM_DATA_DIR/tmp/assets e retorna logo_path", async () => {
    const response = await POST(
      postRequest({ name: "logo.png", type: "image/png", content: PNG_BYTES }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.logo_path).toMatch(/^\/api\/logo\/[\w-]+\.png$/);

    const name = json.logo_path.split("/").pop();
    const written = path.join(dataDir, "tmp", "assets", name);
    expect(fs.existsSync(written)).toBe(true);
    expect(fs.readFileSync(written)).toEqual(Buffer.from(PNG_BYTES));
  });

  it("rejeita quando nenhum arquivo é enviado", async () => {
    const form = new FormData();
    const response = await POST(
      new NextRequest("http://localhost/api/logo", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Selecione uma imagem." });
  });

  it("rejeita tipo de imagem não suportado", async () => {
    const response = await POST(
      postRequest({ name: "logo.gif", type: "image/gif", content: PNG_BYTES }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Formato permitido: PNG, JPG ou WebP.",
    });
  });

  it("rejeita arquivo acima de 2 MB", async () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    const response = await POST(
      postRequest({ name: "big.png", type: "image/png", content: big }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "A imagem deve ter no máximo 2 MB.",
    });
  });
});

describe("GET /api/logo/[name]", () => {
  it("lê o arquivo gravado de CRM_DATA_DIR/tmp/assets", async () => {
    const postResponse = await POST(
      postRequest({ name: "logo.png", type: "image/png", content: PNG_BYTES }),
    );
    const { logo_path: logoPath } = await postResponse.json();
    const name = logoPath.split("/").pop();

    const response = await GET(
      new NextRequest(`http://localhost/api/logo/${name}`),
      { params: Promise.resolve({ name }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      Buffer.from(PNG_BYTES),
    );
  });

  it("rejeita nome sem extensão permitida com 404", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/logo/nao-e-imagem"),
      { params: Promise.resolve({ name: "nao-e-imagem" }) },
    );

    expect(response.status).toBe(404);
  });

  it("rejeita tentativa de path traversal com 404", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/logo/..%2F..%2Fsecret.png"),
      { params: Promise.resolve({ name: "../secret.png" }) },
    );

    expect(response.status).toBe(404);
  });

  it("retorna 404 para arquivo inexistente", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/logo/nao-existe.png"),
      { params: Promise.resolve({ name: "nao-existe.png" }) },
    );

    expect(response.status).toBe(404);
  });
});
