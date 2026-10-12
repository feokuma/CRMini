import { describe, expect, it, vi } from "vitest";
import { getDashboardMetrics } from "./dashboard-metrics.mjs";
import { getGreeting } from "./greeting";
import { toProjectHours, formatBrazilDate, formatBrazilDateTime } from "./project-time";
import { getRecentOpportunities } from "./recent-opportunities.mjs";
import { saoPauloDayRange } from "./task-date";
import { validateTask } from "./task-validation";

describe("regras de tarefas", () => {
  const validTask = {
    contact_type: "email",
    subject: "Retornar proposta",
    scheduled_at: "2026-10-09T14:00:00-03:00",
    client_id: "client-id",
    contact_id: "contact-id",
  };

  it("aceita os três tipos permitidos e descrição opcional", () => {
    for (const contact_type of ["email", "telefone", "compromisso"]) {
      expect(validateTask({ ...validTask, contact_type })).toBeNull();
    }
  });

  it.each([
    ["tipo", { contact_type: "fax" }],
    ["assunto em branco", { subject: "  " }],
    ["data inválida", { scheduled_at: "amanhã" }],
    ["cliente ausente", { client_id: null }],
    ["contato ausente", { contact_id: undefined }],
    ["descrição acima do limite", { description: "x".repeat(5001) }],
  ])("rejeita %s", (_reason, change) => {
    expect(validateTask({ ...validTask, ...change })).not.toBeNull();
  });

  it("calcula limites civis do dia em São Paulo sem deslocar a data", () => {
    expect(saoPauloDayRange("2026-10-12")).toEqual({
      start: "2026-10-12T03:00:00.000Z",
      end: "2026-10-13T03:00:00.000Z",
    });
    expect(() => saoPauloDayRange("2026-02-30")).toThrow();
  });
});

describe("duração e apresentação de datas", () => {
  it.each([["hours", 3, 3], ["days", 2, 16], ["weeks", 2, 80], ["months", 1, 160]] as const)(
    "converte %s para horas", (unit, amount, expected) => {
      expect(toProjectHours(amount, unit)).toBe(expected);
    },
  );

  it("preserva zero, trata vazio como opcional e rejeita valores inválidos", () => {
    expect(toProjectHours(0, "days")).toBe(0);
    expect(toProjectHours("", "hours")).toBeNull();
    expect(() => toProjectHours(-1, "hours")).toThrow(RangeError);
    expect(() => toProjectHours("abc", "hours")).toThrow(RangeError);
  });

  it("formata datas e horários no padrão brasileiro e fuso de Brasília", () => {
    expect(formatBrazilDate("2026-01-01T02:00:00Z")).toBe("31/12/2025");
    expect(formatBrazilDateTime("2026-01-01T02:00:00Z")).toContain("31/12/2025");
    expect(formatBrazilDate(null)).toBe("—");
  });
});

describe("saudação e métricas do painel", () => {
  it("escolhe a saudação conforme hora de Brasília", () => {
    expect(getGreeting(new Date("2026-10-12T10:00:00-03:00"))).toMatch(/, Djardi$/);
    expect(getGreeting(new Date("2026-10-12T15:00:00-03:00"))).toMatch(/, Djardi$/);
    expect(getGreeting(new Date("2026-10-12T21:00:00-03:00"))).toMatch(/, Djardi$/);
  });

  it("agrega conversão sobre oportunidades encerradas e valores por moeda", async () => {
    const query = vi.fn(async () => ({ rows: [{
      contacts_count: 10, opportunities_count: 8, open_opportunities_count: 5,
      won_count: 2, lost_count: 1, open_value_by_currency: { BRL: "1500.00" },
    }] }));
    await expect(getDashboardMetrics(query)).resolves.toMatchObject({
      contactsCount: 10, openOpportunitiesCount: 5, conversionRate: 67,
      openValueByCurrency: { BRL: "1500.00" },
    });
    expect(query.mock.calls[0][0]).toMatch(/GROUP BY currency/);
  });

  it("propaga falhas de consulta ao painel", async () => {
    await expect(getDashboardMetrics(async () => { throw new Error("falha SQL"); })).rejects.toThrow("falha SQL");
  });
});

describe("oportunidades recentes", () => {
  it("consulta os campos da oportunidade em ordem recente e devolve linhas", async () => {
    const rows = [{ id: "op-1", title: "Projeto", status: "Proposta" }];
    const query = vi.fn(async () => ({ rows }));
    await expect(getRecentOpportunities(query)).resolves.toEqual(rows);
    expect(query.mock.calls[0][0]).toMatch(/ORDER BY.*created_at DESC/is);
    expect(query.mock.calls[0][0]).toMatch(/LIMIT/);
  });

  it("retorna vazio sem resultados e propaga erro do banco", async () => {
    await expect(getRecentOpportunities(async () => ({ rows: [] }))).resolves.toEqual([]);
    await expect(getRecentOpportunities(async () => { throw new Error("sem banco"); })).rejects.toThrow("sem banco");
  });
});
