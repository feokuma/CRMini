import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SQLITE_PATH = ":memory:";
});

import { getDb } from "./db";

describe("getDb", () => {
  it("reutiliza a mesma conexão entre chamadas", () => {
    expect(getDb()).toBe(getDb());
  });

  it("habilita verificação de chaves estrangeiras na conexão", () => {
    expect(getDb().pragma("foreign_keys", { simple: true })).toBe(1);
  });

  it("aplica o schema inicial com as tabelas do CRM", () => {
    const tables = getDb()
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
      .all()
      .map((row) => (row as { name: string }).name);
    expect(tables).toEqual(["clients", "contacts", "opportunities", "tasks"]);
  });
});
