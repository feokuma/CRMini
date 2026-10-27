import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createContact, listContacts } = vi.hoisted(() => ({
  createContact: vi.fn(),
  listContacts: vi.fn(),
}));
vi.mock("@/lib/repositories/contacts", () => ({ listContacts, createContact }));
import { GET, POST } from "./route";

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getRequest(query = "") {
  return new NextRequest(`http://localhost/api/contacts${query}`);
}

describe("GET /api/contacts", () => {
  beforeEach(() => {
    listContacts.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("lista apenas contatos ativos por padrão", async () => {
    listContacts.mockResolvedValue([{ id: "contact-1", is_active: true }]);

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      { id: "contact-1", is_active: true },
    ]);
    expect(listContacts).toHaveBeenCalledWith(null, null, false);
  });

  it("inclui desativados quando include_inactive=1", async () => {
    listContacts.mockResolvedValue([
      { id: "contact-1", is_active: true },
      { id: "contact-2", is_active: false },
    ]);

    const response = await GET(getRequest("?include_inactive=1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toHaveLength(2);
    expect(listContacts).toHaveBeenCalledWith(null, null, true);
  });

  it("aceita include_inactive=true e repassa busca e segmento", async () => {
    listContacts.mockResolvedValue([]);

    const response = await GET(
      getRequest("?include_inactive=true&q=alfa&segment=Ind%C3%BAstria"),
    );

    expect(response.status).toBe(200);
    expect(listContacts).toHaveBeenCalledWith("alfa", "Indústria", true);
  });

  it("retorna 503 sem vazar detalhes quando o repositório falha", async () => {
    listContacts.mockRejectedValue(new Error("database is locked"));

    const response = await GET(getRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Não foi possível carregar os contatos.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("POST /api/contacts", () => {
  beforeEach(() => {
    createContact.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rejects missing required contact and client", async () => {
    const response = await POST(postRequest({ full_name: " " }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Informe o nome do contato.",
    });
    expect(createContact).not.toHaveBeenCalled();
  });

  it("rejeita corpo que não é JSON", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "não é json",
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Dados inválidos." });
    expect(createContact).not.toHaveBeenCalled();
  });

  it("exige apenas o nome para recusar o contato", async () => {
    const response = await POST(
      postRequest({ full_name: "   ", client_id: "client-id" }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Informe o nome do contato.",
    });
    expect(createContact).not.toHaveBeenCalled();
  });

  it("exige o cliente vinculado", async () => {
    const response = await POST(postRequest({ full_name: "Nome" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Selecione um cliente." });
    expect(createContact).not.toHaveBeenCalled();
  });

  it("recusa cliente em branco", async () => {
    const response = await POST(
      postRequest({ full_name: "Nome", client_id: "   " }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Selecione um cliente." });
    expect(createContact).not.toHaveBeenCalled();
  });

  it("creates contact with associated client", async () => {
    createContact.mockResolvedValue({ id: "contact-id", client_id: "client-id", full_name: "Nome" });
    const payload = { full_name: "Nome", client_id: "client-id" };
    const response = await POST(postRequest(payload));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ client_id: "client-id" });
    expect(createContact).toHaveBeenCalledWith(payload);
  });

  it("returns not found for an unavailable client", async () => {
    createContact.mockResolvedValue(undefined);
    const response = await POST(postRequest({ full_name: "Nome", client_id: "missing" }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Cliente não encontrado ou inativo.",
    });
  });

  it("retorna 500 sem vazar detalhes quando o repositório falha", async () => {
    createContact.mockRejectedValue(new Error("database is locked"));
    const response = await POST(postRequest({ full_name: "Nome", client_id: "client-id" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Não foi possível cadastrar o contato.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});
