import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getUserName, saveUserName } = vi.hoisted(() => ({
  getUserName: vi.fn(),
  saveUserName: vi.fn(),
}));

vi.mock("@/lib/repositories/settings", () => ({ getUserName, saveUserName }));

import { GET, PUT } from "./route";

const invalidNameMessage = "Nome do usuário inválido.";
const maxLengthMessage = "O nome do usuário deve ter no máximo 80 caracteres.";

function putRequest(body: unknown) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return new NextRequest("http://localhost/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: raw,
  });
}

describe("GET /api/settings", () => {
  beforeEach(() => {
    getUserName.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("devolve o nome configurado", async () => {
    getUserName.mockResolvedValue("Ana");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ userName: "Ana" });
  });

  it("devolve null quando o nome não está configurado", async () => {
    getUserName.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ userName: null });
  });

  it("retorna 500 sem vazar detalhes quando o repositório falha", async () => {
    getUserName.mockRejectedValue(new Error("database is locked"));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Não foi possível carregar as configurações.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("PUT /api/settings", () => {
  beforeEach(() => {
    saveUserName.mockReset();
    saveUserName.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("normaliza espaços e salva o nome retornando o valor normalizado", async () => {
    const response = await PUT(putRequest({ userName: "  Maria   Clara " }));

    expect(response.status).toBe(200);
    expect(saveUserName).toHaveBeenCalledWith("Maria Clara");
    await expect(response.json()).resolves.toEqual({ userName: "Maria Clara" });
  });

  it.each([
    ["vazio", ""],
    ["só espaços", "   \t "],
  ])("remove o nome quando o valor é %s", async (_label, userName) => {
    const response = await PUT(putRequest({ userName }));

    expect(response.status).toBe(200);
    expect(saveUserName).toHaveBeenCalledWith(null);
    await expect(response.json()).resolves.toEqual({ userName: null });
  });

  it("retorna 400 para corpo que não é JSON", async () => {
    const response = await PUT(putRequest("não é json"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Corpo JSON inválido.",
    });
    expect(saveUserName).not.toHaveBeenCalled();
  });

  it.each([
    ["array", []],
    ["null", null],
  ])("retorna 400 quando o corpo é %s", async (_label, body) => {
    const response = await PUT(putRequest(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Dados inválidos.",
    });
    expect(saveUserName).not.toHaveBeenCalled();
  });

  it.each([
    ["ausente", {}],
    ["número", { userName: 42 }],
    ["null", { userName: null }],
  ])("retorna 400 quando userName está %s", async (_label, body) => {
    const response = await PUT(putRequest(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: invalidNameMessage,
    });
    expect(saveUserName).not.toHaveBeenCalled();
  });

  it("retorna 400 com a mensagem de limite para 81 caracteres", async () => {
    const response = await PUT(
      putRequest({ userName: "a".repeat(81) }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: maxLengthMessage,
    });
    expect(saveUserName).not.toHaveBeenCalled();
  });

  it("retorna 500 sem vazar detalhes quando o repositório falha", async () => {
    saveUserName.mockRejectedValue(new Error("database is locked"));

    const response = await PUT(putRequest({ userName: "Ana" }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Não foi possível salvar as configurações.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});
