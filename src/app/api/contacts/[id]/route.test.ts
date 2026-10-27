import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getContact, updateContact, deactivateContact, reactivateContact } =
  vi.hoisted(() => ({
    getContact: vi.fn(),
    updateContact: vi.fn(),
    deactivateContact: vi.fn(),
    reactivateContact: vi.fn(),
  }));

vi.mock("@/lib/repositories/contacts", () => ({
  getContact,
  updateContact,
  deactivateContact,
  reactivateContact,
}));

import { DELETE, GET, PATCH, PUT } from "./route";

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

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/contacts/contact-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest() {
  return new NextRequest("http://localhost/api/contacts/contact-1", {
    method: "DELETE",
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

describe("PATCH /api/contacts/[id]", () => {
  beforeEach(() => {
    getContact.mockReset();
    deactivateContact.mockReset();
    reactivateContact.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("desativa o contato e retorna o registro atualizado", async () => {
    deactivateContact.mockResolvedValue(true);
    getContact.mockResolvedValue({
      id: "contact-1",
      full_name: "Pessoa Exemplo",
      is_active: false,
    });

    const response = await PATCH(patchRequest({ is_active: false }), params);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "contact-1",
      full_name: "Pessoa Exemplo",
      is_active: false,
    });
    expect(deactivateContact).toHaveBeenCalledWith("contact-1");
    expect(reactivateContact).not.toHaveBeenCalled();
  });

  it("reativa o contato e retorna o registro atualizado", async () => {
    reactivateContact.mockResolvedValue(true);
    getContact.mockResolvedValue({
      id: "contact-1",
      full_name: "Pessoa Exemplo",
      is_active: true,
    });

    const response = await PATCH(patchRequest({ is_active: true }), params);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "contact-1",
      full_name: "Pessoa Exemplo",
      is_active: true,
    });
    expect(reactivateContact).toHaveBeenCalledWith("contact-1");
    expect(deactivateContact).not.toHaveBeenCalled();
  });

  it.each([
    ["campo ausente", {}],
    ["string", { is_active: "true" }],
    ["número", { is_active: 1 }],
    ["nulo", { is_active: null }],
  ])("retorna 400 quando is_active é %s", async (_label, body) => {
    const response = await PATCH(patchRequest(body), params);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Informe se o contato está ativo.",
    });
    expect(deactivateContact).not.toHaveBeenCalled();
    expect(reactivateContact).not.toHaveBeenCalled();
    expect(getContact).not.toHaveBeenCalled();
  });

  it("retorna 404 sem mutar quando o contato não existe", async () => {
    getContact.mockResolvedValue(undefined);

    const response = await PATCH(patchRequest({ is_active: false }), params);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Contato não encontrado.",
    });
    expect(deactivateContact).not.toHaveBeenCalled();
    expect(reactivateContact).not.toHaveBeenCalled();
  });

  it("retorna 500 sem vazar detalhes quando o repositório falha", async () => {
    getContact.mockResolvedValue({ id: "contact-1", full_name: "Pessoa Exemplo" });
    deactivateContact.mockRejectedValue(new Error("database is locked"));

    const response = await PATCH(patchRequest({ is_active: false }), params);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Não foi possível atualizar o status do contato.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("DELETE /api/contacts/[id]", () => {
  beforeEach(() => {
    deactivateContact.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("desativa o contato e retorna 204", async () => {
    deactivateContact.mockResolvedValue(true);

    const response = await DELETE(deleteRequest(), params);

    expect(response.status).toBe(204);
    expect(deactivateContact).toHaveBeenCalledWith("contact-1");
  });

  it("retorna 404 quando o contato não existe", async () => {
    deactivateContact.mockResolvedValue(false);

    const response = await DELETE(deleteRequest(), params);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Contato não encontrado.",
    });
  });

  it("retorna 500 sem vazar detalhes quando o repositório falha", async () => {
    deactivateContact.mockRejectedValue(new Error("database is locked"));

    const response = await DELETE(deleteRequest(), params);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Não foi possível desativar o contato.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});
