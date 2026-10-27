import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { updateClient } = vi.hoisted(() => ({ updateClient: vi.fn() }));

vi.mock("@/lib/repositories/clients", () => ({
  updateClient,
  getClient: vi.fn(),
  deactivateClient: vi.fn(),
}));

import { PUT } from "./route";

function putRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/clients/client-1", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: "client-1" }) };

describe("PUT /api/clients/[id]", () => {
  beforeEach(() => {
    updateClient.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("aceita a remoção de contatos sem bloquear por vínculos", async () => {
    updateClient.mockResolvedValue({
      id: "client-1",
      company_name: "Empresa",
      contacts: [],
    });

    const response = await PUT(
      putRequest({ company_name: "Empresa", contacts: [] }),
      params,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "client-1",
      company_name: "Empresa",
      contacts: [],
    });
    expect(updateClient).toHaveBeenCalledWith("client-1", {
      company_name: "Empresa",
      contacts: [],
    });
  });

  it("mantém o contrato de sucesso", async () => {
    updateClient.mockResolvedValue({ id: "client-1", company_name: "Empresa" });

    const response = await PUT(
      putRequest({ company_name: "Empresa", contacts: [] }),
      params,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "client-1",
      company_name: "Empresa",
    });
  });

  it("retorna 500 sem vazar detalhes quando o repositório falha", async () => {
    updateClient.mockRejectedValue(new Error("database is locked"));

    const response = await PUT(
      putRequest({ company_name: "Empresa", contacts: [] }),
      params,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Não foi possível atualizar o cliente.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});
