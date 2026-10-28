import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { updateTaskStatus } = vi.hoisted(() => ({ updateTaskStatus: vi.fn() }));

vi.mock("@/lib/repositories/tasks", () => ({ updateTaskStatus }));

import { PATCH } from "./route";

const params = { params: Promise.resolve({ id: "task-1" }) };

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/tasks/task-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawPatchRequest(body: string) {
  return new NextRequest("http://localhost/api/tasks/task-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("PATCH /api/tasks/[id]", () => {
  beforeEach(() => {
    updateTaskStatus.mockReset();
  });

  it("retorna 400 para corpo JSON malformado", async () => {
    const response = await PATCH(rawPatchRequest("não é json"), params);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Corpo JSON inválido.",
    });
    expect(updateTaskStatus).not.toHaveBeenCalled();
  });

  it("retorna 400 para status fora de Aberto/Concluído sem chamar o repositório", async () => {
    const response = await PATCH(patchRequest({ status: "Inválido" }), params);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Status inválido." });
    expect(updateTaskStatus).not.toHaveBeenCalled();
  });

  it("altera o status e retorna a tarefa", async () => {
    updateTaskStatus.mockResolvedValue({ id: "task-1", status: "Concluído" });

    const response = await PATCH(patchRequest({ status: "Concluído" }), params);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "task-1",
      status: "Concluído",
    });
    expect(updateTaskStatus).toHaveBeenCalledWith("task-1", "Concluído");
  });

  it("retorna 404 quando a tarefa não existe", async () => {
    updateTaskStatus.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ status: "Aberto" }), params);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Tarefa não encontrada.",
    });
  });

  it("retorna 400 quando o repositório lança exceção", async () => {
    updateTaskStatus.mockRejectedValue(new Error("database is locked"));

    const response = await PATCH(patchRequest({ status: "Aberto" }), params);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Não foi possível atualizar a tarefa.",
    });
  });
});
