import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { updateClient, ClientContactsInUseError } = vi.hoisted(() => {
  class ClientContactsInUseError extends Error {
    constructor(contactNames: string[]) {
      super(
        `Não é possível remover contatos com tarefas ou oportunidades vinculadas: ${contactNames.join(", ")}.`,
      );
      this.name = "ClientContactsInUseError";
    }
  }
  return { updateClient: vi.fn(), ClientContactsInUseError };
});

vi.mock("@/lib/repositories/clients", () => ({
  updateClient,
  ClientContactsInUseError,
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
  });

  it("retorna 409 quando a remoção de contato é bloqueada por vínculos", async () => {
    updateClient.mockRejectedValue(
      new ClientContactsInUseError(["Maria Silva"]),
    );

    const response = await PUT(
      putRequest({ company_name: "Empresa", contacts: [] }),
      params,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "Não é possível remover contatos com tarefas ou oportunidades vinculadas: Maria Silva.",
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
});
