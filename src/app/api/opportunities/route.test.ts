import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { listOpportunities, createOpportunity } = vi.hoisted(() => ({
  listOpportunities: vi.fn(),
  createOpportunity: vi.fn(),
}));

vi.mock("@/lib/repositories/opportunities", () => ({
  listOpportunities,
  createOpportunity,
}));

import { GET, POST } from "./route";

function getRequest(query = "") {
  return new NextRequest(`http://localhost/api/opportunities${query}`);
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/opportunities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawPostRequest(body: string) {
  return new NextRequest("http://localhost/api/opportunities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

const validOpportunity = () => ({
  name: "Projeto de Integração",
  client_id: "client-1",
  contact_id: "contact-1",
});

describe("GET /api/opportunities", () => {
  beforeEach(() => {
    listOpportunities.mockReset();
  });

  it("repassa busca (com trim), cliente e status", async () => {
    listOpportunities.mockResolvedValue([]);

    const response = await GET(
      getRequest("?q=%20alfa%20&client_id=client-1&status=Proposta"),
    );

    expect(response.status).toBe(200);
    expect(listOpportunities).toHaveBeenCalledWith(
      "alfa",
      "client-1",
      "Proposta",
    );
  });

  it("trata parâmetros ausentes como null", async () => {
    listOpportunities.mockResolvedValue([]);

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    expect(listOpportunities).toHaveBeenCalledWith(null, null, null);
  });

  it("retorna 503 quando o repositório falha", async () => {
    listOpportunities.mockRejectedValue(new Error("database is locked"));

    const response = await GET(getRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Não foi possível carregar as oportunidades.",
    });
  });
});

describe("POST /api/opportunities", () => {
  beforeEach(() => {
    createOpportunity.mockReset();
  });

  it("retorna 400 para corpo JSON malformado", async () => {
    const response = await POST(rawPostRequest("não é json"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Corpo JSON inválido.",
    });
    expect(createOpportunity).not.toHaveBeenCalled();
  });

  it.each([
    ["sem nome", { client_id: "client-1", contact_id: "contact-1" }],
    ["sem cliente", { name: "Projeto", contact_id: "contact-1" }],
    ["sem contato", { name: "Projeto", client_id: "client-1" }],
  ])("retorna 400 informando dados obrigatórios quando %s", async (_label, body) => {
    const response = await POST(postRequest(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Informe nome, cliente e contato.",
    });
    expect(createOpportunity).not.toHaveBeenCalled();
  });

  it("retorna 400 para status inválido", async () => {
    const response = await POST(
      postRequest({ ...validOpportunity(), status: "Inválido" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Status inválido." });
    expect(createOpportunity).not.toHaveBeenCalled();
  });

  it("exige motivo para o status Perdida", async () => {
    const response = await POST(
      postRequest({ ...validOpportunity(), status: "Perdida" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Informe um motivo apenas para oportunidades perdidas.",
    });
    expect(createOpportunity).not.toHaveBeenCalled();
  });

  it("rejeita motivo quando o status não é Perdida", async () => {
    const response = await POST(
      postRequest({
        ...validOpportunity(),
        status: "Ganha",
        loss_reason: "Preço",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Informe um motivo apenas para oportunidades perdidas.",
    });
    expect(createOpportunity).not.toHaveBeenCalled();
  });

  it.each(["value", "budget", "project_hours"])(
    "retorna 400 quando %s é negativo",
    async (key) => {
      const response = await POST(
        postRequest({ ...validOpportunity(), [key]: "-1" }),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: `O campo ${key} deve ser um número não negativo.`,
      });
      expect(createOpportunity).not.toHaveBeenCalled();
    },
  );

  it("retorna 400 quando value não é numérico", async () => {
    const response = await POST(
      postRequest({ ...validOpportunity(), value: "abc" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "O campo value deve ser um número não negativo.",
    });
    expect(createOpportunity).not.toHaveBeenCalled();
  });

  it("retorna 400 para moeda inválida", async () => {
    const response = await POST(
      postRequest({ ...validOpportunity(), currency: "GBP" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Moeda inválida." });
    expect(createOpportunity).not.toHaveBeenCalled();
  });

  it("retorna 400 para moeda do budget inválida", async () => {
    const response = await POST(
      postRequest({ ...validOpportunity(), budget_currency: "GBP" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Moeda do budget inválida.",
    });
    expect(createOpportunity).not.toHaveBeenCalled();
  });

  it("aceita valores e motivos vazios quando o contrato permite", async () => {
    createOpportunity.mockResolvedValue({ id: "opp-1" });

    const response = await POST(
      postRequest({
        ...validOpportunity(),
        status: "Ganha",
        loss_reason: "",
        value: "",
        budget: "",
        project_hours: "",
        budget_currency: "",
      }),
    );

    expect(response.status).toBe(201);
    expect(createOpportunity).toHaveBeenCalled();
  });

  it("cria a oportunidade e retorna 201", async () => {
    const payload = validOpportunity();
    createOpportunity.mockResolvedValue({ id: "opp-1", name: "Projeto" });

    const response = await POST(postRequest(payload));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: "opp-1",
      name: "Projeto",
    });
    expect(createOpportunity).toHaveBeenCalledWith(payload);
  });

  it("retorna 400 quando cliente ou contato não são válidos", async () => {
    createOpportunity.mockResolvedValue(null);

    const response = await POST(postRequest(validOpportunity()));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Cliente ativo ou contato válido não encontrado.",
    });
  });

  it("retorna 400 quando o repositório lança exceção", async () => {
    createOpportunity.mockRejectedValue(new Error("database is locked"));

    const response = await POST(postRequest(validOpportunity()));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Não foi possível cadastrar a oportunidade.",
    });
  });
});
