import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { listTasks, createTask } = vi.hoisted(() => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
}));

vi.mock("@/lib/repositories/tasks", () => ({ listTasks, createTask }));

import { GET, POST } from "./route";

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawPostRequest(body: string) {
  return new NextRequest("http://localhost/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

const validTask = () => ({
  contact_type: "email",
  subject: "Retornar proposta",
  scheduled_at: "2026-10-12T09:00:00-03:00",
  client_id: "client-1",
  contact_id: "contact-1",
});

describe("GET /api/tasks", () => {
  beforeEach(() => listTasks.mockReset().mockResolvedValue([]));

  it("requests tasks without a date range when date is omitted", async () => {
    const response = await GET(new NextRequest("http://localhost/api/tasks"));
    expect(response.status).toBe(200);
    expect(listTasks).toHaveBeenCalledWith(null, null, null);
  });

  it("applies the requested day and status filters", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/tasks?date=2026-10-14&status=Aberto",
      ),
    );
    expect(response.status).toBe(200);
    expect(listTasks).toHaveBeenCalledWith(
      "2026-10-14T03:00:00.000Z",
      "2026-10-15T03:00:00.000Z",
      "Aberto",
    );
  });

  it("rejects an unsupported status", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/tasks?status=Inválido"),
    );
    expect(response.status).toBe(400);
    expect(listTasks).not.toHaveBeenCalled();
  });
});

describe("POST /api/tasks", () => {
  beforeEach(() => {
    createTask.mockReset();
  });

  it("retorna 400 para corpo JSON malformado", async () => {
    const response = await POST(rawPostRequest("não é json"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Corpo JSON inválido.",
    });
    expect(createTask).not.toHaveBeenCalled();
  });

  it("retorna 400 para corpo array", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "[]",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Dados inválidos." });
    expect(createTask).not.toHaveBeenCalled();
  });

  it.each([
    ["assunto vazio", { ...validTask(), subject: "   " }, "Informe um assunto (até 200 caracteres)."],
    ["tipo inválido", { ...validTask(), contact_type: "sms" }, "Tipo de contato inválido."],
    ["cliente ausente", { ...validTask(), client_id: undefined }, "Informe cliente e contato."],
    ["contato ausente", { ...validTask(), contact_id: undefined }, "Informe cliente e contato."],
    ["data/hora inválida", { ...validTask(), scheduled_at: "não é data" }, "Informe uma data e hora válidas."],
  ])("retorna 400 para %s", async (_label, body, message) => {
    const response = await POST(postRequest(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: message });
    expect(createTask).not.toHaveBeenCalled();
  });

  it("retorna 400 quando cliente ou contato não são válidos", async () => {
    createTask.mockResolvedValue(null);

    const response = await POST(postRequest(validTask()));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Cliente ativo ou contato válido não encontrado.",
    });
  });

  it("cria a tarefa e retorna 201", async () => {
    createTask.mockResolvedValue({ id: "task-1", subject: "Retornar proposta" });

    const payload = validTask();
    const response = await POST(postRequest(payload));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: "task-1",
      subject: "Retornar proposta",
    });
    expect(createTask).toHaveBeenCalledWith(payload);
  });

  it("retorna 400 quando o repositório lança exceção", async () => {
    createTask.mockRejectedValue(new Error("database is locked"));

    const response = await POST(postRequest(validTask()));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Não foi possível cadastrar a tarefa.",
    });
  });
});
