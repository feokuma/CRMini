import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SQLITE_PATH = ":memory:";
});

import { getDb } from "@/lib/db";
import { saoPauloDayRange } from "@/lib/task-date";
import { createClient, deactivateClient } from "./clients";
import { createTask, listTasks, updateTaskStatus } from "./tasks";

function cleanTables() {
  getDb().exec(
    "DELETE FROM tasks; DELETE FROM opportunities; DELETE FROM contacts; DELETE FROM clients;",
  );
}

let clientId: string;
let contactId: string;

beforeEach(async () => {
  cleanTables();
  const client = await createClient({
    company_name: "Empresa de Tarefas Ltda.",
    contacts: [{ full_name: "Contato de Tarefas", is_primary: true }],
  });
  clientId = client.id;
  contactId = (
    getDb()
      .prepare("SELECT id FROM contacts WHERE client_id = ?")
      .get(clientId) as { id: string }
  ).id;
});

const baseTask = () => ({
  contact_type: "email",
  subject: "  Retornar proposta  ",
  description: null,
  scheduled_at: "2026-10-12T09:00:00-03:00",
  client_id: clientId,
  contact_id: contactId,
});

describe("createTask", () => {
  it("cria tarefa com assunto limpo e instante normalizado em UTC", async () => {
    const created = (await createTask(baseTask())) as Record<string, unknown>;

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.subject).toBe("Retornar proposta");
    expect(created.scheduled_at).toBe("2026-10-12T12:00:00.000Z");
    expect(created.status).toBe("Aberto");
  });

  it("retorna null para cliente desativado", async () => {
    await deactivateClient(clientId);
    expect(await createTask(baseTask())).toBeNull();
  });

  it("retorna null para contato de outro cliente", async () => {
    const other = await createClient({
      company_name: "Outra Empresa Ltda.",
      contacts: [{ full_name: "Contato Alheio" }],
    });
    const otherContactId = (
      getDb()
        .prepare("SELECT id FROM contacts WHERE client_id = ?")
        .get(other.id) as { id: string }
    ).id;

    expect(await createTask({ ...baseTask(), contact_id: otherContactId })).toBeNull();
  });

  it("rejeita assunto vazio pela constraint do schema", async () => {
    await expect(
      createTask({ ...baseTask(), subject: "   " }),
    ).rejects.toThrow(/subject/);
  });
});

describe("listTasks", () => {
  beforeEach(async () => {
    // Limites do dia civil 2026-10-12 em São Paulo: 03:00Z até 03:00Z do dia seguinte.
    await createTask({
      ...baseTask(),
      subject: "Antes do dia",
      scheduled_at: "2026-10-12T02:59:59.000Z",
    });
    await createTask({
      ...baseTask(),
      subject: "No início do dia",
      scheduled_at: "2026-10-12T03:00:00.000Z",
    });
    await createTask({
      ...baseTask(),
      subject: "No fim do dia",
      scheduled_at: "2026-10-13T02:59:59.000Z",
    });
    await createTask({
      ...baseTask(),
      subject: "No dia seguinte",
      scheduled_at: "2026-10-13T03:00:00.000Z",
    });
  });

  it("filtra pelo dia civil de São Paulo sem deslocar instantes", async () => {
    const { start, end } = saoPauloDayRange("2026-10-12");
    const tasks = (await listTasks(start, end, null)) as Record<
      string,
      unknown
    >[];

    expect(tasks.map((task) => task.subject)).toEqual([
      "No início do dia",
      "No fim do dia",
    ]);
  });

  it("lista tudo sem filtro de data e aplica filtro de status", async () => {
    const all = (await listTasks(null, null, null)) as unknown[];
    expect(all).toHaveLength(4);

    const { start, end } = saoPauloDayRange("2026-10-12");
    const done = (await listTasks(start, end, "Concluído")) as unknown[];
    expect(done).toHaveLength(0);
  });

  it("retorna dados do cliente e do contato vinculados", async () => {
    const { start, end } = saoPauloDayRange("2026-10-12");
    const tasks = (await listTasks(start, end, null)) as Record<
      string,
      unknown
    >[];

    expect(tasks[0]).toMatchObject({
      company_name: "Empresa de Tarefas Ltda.",
      contact_name: "Contato de Tarefas",
    });
  });
});

describe("updateTaskStatus", () => {
  it("alterna o status e retorna null para inexistente", async () => {
    const created = (await createTask(baseTask())) as Record<string, unknown>;

    const updated = await updateTaskStatus(created.id as string, "Concluído");
    expect(updated).toEqual({ id: created.id, status: "Concluído" });

    expect(
      await updateTaskStatus("00000000-0000-4000-8000-000000000000", "Aberto"),
    ).toBeNull();
  });
});
