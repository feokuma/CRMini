import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createContact } = vi.hoisted(() => ({ createContact: vi.fn() }));
vi.mock("@/lib/repositories/contacts", () => ({ listContacts: vi.fn(), createContact }));
import { POST } from "./route";

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

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
