import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getContact, updateContact } = vi.hoisted(() => ({
  getContact: vi.fn(),
  updateContact: vi.fn(),
}));

vi.mock("@/lib/repositories/contacts", () => ({ getContact, updateContact }));

import { GET, PUT } from "./route";

const params = { params: Promise.resolve({ id: "contact-1" }) };

function getRequest() {
  return new NextRequest("http://localhost/api/contacts/contact-1");
}

function putRequest(body: unknown) {
  return new NextRequest("http://localhost/api/contacts/contact-1", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawPutRequest(body: string) {
  return new NextRequest("http://localhost/api/contacts/contact-1", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("GET /api/contacts/[id]", () => {
  beforeEach(() => {
    getContact.mockReset();
    updateContact.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("retorna o contato encontrado", async () => {
    getContact.mockResolvedValue({
      id: "contact-1",
      full_name: "Pessoa Exemplo",
      is_primary: true,
    });

    const response = await GET(getRequest(), params);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "contact-1",
      full_name: "Pessoa Exemplo",
      is_primary: true,
    });
    expect(getContact).toHaveBeenCalledWith("contact-1");
  });

  it("retorna 404 quando o contato não existe", async () => {
    getContact.mockResolvedValue(undefined);

    const response = await GET(getRequest(), params);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Contato não encontrado.",
    });
  });

  it("retorna 503 sem vazar detalhes quando o repositório falha", async () => {
    getContact.mockRejectedValue(new Error("database is locked"));

    const response = await GET(getRequest(), params);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Não foi possível carregar o contato.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("PUT /api/contacts/[id]", () => {
  beforeEach(() => {
    getContact.mockReset();
    updateContact.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("retorna 400 para corpo que não é JSON", async () => {
    const response = await PUT(rawPutRequest("não é json"), params);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Dados inválidos.",
    });
    expect(updateContact).not.toHaveBeenCalled();
  });

  it("retorna 400 quando o nome está ausente", async () => {
    const response = await PUT(putRequest({ job_title: "Analista" }), params);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Informe o nome do contato.",
    });
    expect(updateContact).not.toHaveBeenCalled();
  });

  it("retorna 400 quando o nome está em branco", async () => {
    const response = await PUT(
      putRequest({ full_name: "   ", client_id: "client-1" }),
      params,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Informe o nome do contato.",
    });
    expect(updateContact).not.toHaveBeenCalled();
  });

  it("atualiza o contato sem exigir client_id", async () => {
    const payload = { full_name: "Pessoa Atualizada", notes: "Observação" };
    updateContact.mockResolvedValue({
      id: "contact-1",
      ...payload,
      is_primary: false,
    });

    const response = await PUT(putRequest(payload), params);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "contact-1",
      ...payload,
      is_primary: false,
    });
    expect(updateContact).toHaveBeenCalledWith("contact-1", payload);
  });

  it("retorna 404 quando o repositório não encontra o contato", async () => {
    updateContact.mockResolvedValue(undefined);

    const response = await PUT(putRequest({ full_name: "Pessoa" }), params);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Contato não encontrado.",
    });
  });

  it("retorna 500 sem vazar detalhes quando o repositório falha", async () => {
    updateContact.mockRejectedValue(new Error("database is locked"));

    const response = await PUT(putRequest({ full_name: "Pessoa" }), params);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Não foi possível atualizar o contato.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});
