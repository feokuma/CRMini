import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SQLITE_PATH = ":memory:";
});

import { getDb } from "@/lib/db";
import { createClient } from "./clients";
import { listContacts } from "./contacts";

function cleanTables() {
  getDb().exec(
    "DELETE FROM tasks; DELETE FROM opportunities; DELETE FROM contacts; DELETE FROM clients;",
  );
}

beforeEach(async () => {
  cleanTables();
  await createClient({
    company_name: "Aurora Tecnologia Ltda.",
    trade_name: "Aurora",
    industry: "Tecnologia da Informação",
    contacts: [
      {
        full_name: "Mariana Costa",
        email: "mariana@example.com",
        job_title: "Diretora",
        is_primary: true,
      },
      { full_name: "Rafael Mendes", job_title: "Gerente" },
    ],
  });
  await createClient({
    company_name: "Verde Vivo S.A.",
    industry: "Varejo e produtos naturais",
    contacts: [{ full_name: "Camila Oliveira", is_primary: true }],
  });
});

describe("listContacts", () => {
  it("lista contatos com dados da empresa e is_primary booleano", async () => {
    const contacts = await listContacts(null, null);

    expect(contacts).toHaveLength(3);
    const mariana = contacts.find(
      (contact) => contact.full_name === "Mariana Costa",
    )!;
    expect(mariana).toMatchObject({
      company_name: "Aurora Tecnologia Ltda.",
      trade_name: "Aurora",
      industry: "Tecnologia da Informação",
      is_primary: true,
    });
    expect(typeof mariana.is_primary).toBe("boolean");
    const rafael = contacts.find(
      (contact) => contact.full_name === "Rafael Mendes",
    )!;
    expect(rafael.is_primary).toBe(false);
  });

  it("ordena por empresa com contato principal primeiro", async () => {
    const contacts = await listContacts(null, null);

    expect(contacts.map((contact) => contact.full_name)).toEqual([
      "Mariana Costa",
      "Rafael Mendes",
      "Camila Oliveira",
    ]);
  });

  it.each([
    ["nome do contato", "rafael", ["Rafael Mendes"]],
    ["e-mail", "mariana@example.com", ["Mariana Costa"]],
    ["cargo", "diretora", ["Mariana Costa"]],
    ["nome fantasia da empresa", "aurora", ["Mariana Costa", "Rafael Mendes"]],
    ["termo sem correspondência", "xyz", []],
  ])("filtra por %s", async (_label, query, expected) => {
    const contacts = await listContacts(query, null);
    expect(contacts.map((contact) => contact.full_name)).toEqual(expected);
  });

  it("busca ignorando acentos e caixa em nomes e empresas", async () => {
    await createClient({
      company_name: "São Paulo Serviços",
      contacts: [{ full_name: "José Silva" }],
    });
    expect(
      (await listContacts("JOSÉ", null)).map((c) => c.full_name),
    ).toContain("José Silva");
    expect(
      (await listContacts("sao paulo", null)).map((c) => c.full_name),
    ).toContain("José Silva");
  });

  it("filtra por segmento da empresa", async () => {
    const contacts = await listContacts(null, "Varejo e produtos naturais");
    expect(contacts.map((contact) => contact.full_name)).toEqual([
      "Camila Oliveira",
    ]);
  });
});
