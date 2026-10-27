import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SQLITE_PATH = ":memory:";
});

import { getDb } from "@/lib/db";
import { createClient, deactivateClient } from "./clients";
import { createContact, getContact, listContacts, updateContact } from "./contacts";

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
  it("cria contato com cliente vinculado e campos opcionais nulos", async () => {
    const company = getDb().prepare("SELECT id FROM clients LIMIT 1").get() as { id: string };
    const contact = await createContact({ client_id: company.id, full_name: "  Novo Nome  " });
    expect(contact).toMatchObject({ client_id: company.id, full_name: "Novo Nome", birthday: null });
  });

  it("não cria contato sem cliente existente", async () => {
    await expect(createContact({ client_id: "missing", full_name: "Nome" })).resolves.toBeUndefined();
  });

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

  it("busca contatos pelos dígitos do telefone formatado", async () => {
    const company = getDb()
      .prepare("SELECT id FROM clients WHERE company_name = ?")
      .get("Aurora Tecnologia Ltda.") as { id: string };
    await createContact({
      client_id: company.id,
      full_name: "Contato Telefone",
      phone: "(11) 91234-5678",
    });

    for (const query of ["1191234", "91234", "912345678"]) {
      const contacts = await listContacts(query, null);
      expect(contacts.map((contact) => contact.full_name)).toEqual([
        "Contato Telefone",
      ]);
    }

    expect(await listContacts("xyz", null)).toEqual([]);
  });

  it("filtra por segmento da empresa", async () => {
    const contacts = await listContacts(null, "Varejo e produtos naturais");
    expect(contacts.map((contact) => contact.full_name)).toEqual([
      "Camila Oliveira",
    ]);
  });
});

describe("createContact", () => {
  function companyId(companyName: string) {
    return (
      getDb()
        .prepare("SELECT id FROM clients WHERE company_name = ?")
        .get(companyName) as { id: string }
    ).id;
  }

  function contactCount() {
    return (
      getDb().prepare("SELECT COUNT(*) AS total FROM contacts").get() as {
        total: number;
      }
    ).total;
  }

  it("persiste todos os campos opcionais e o contato principal", async () => {
    const clientId = companyId("Verde Vivo S.A.");
    const contact = await createContact({
      client_id: clientId,
      full_name: "  Beatriz Lima  ",
      job_title: "CTO",
      email: "beatriz@example.com",
      phone: "+55 11 3000-1000",
      mobile: "+55 11 90000-1000",
      birthday: "1990-02-03",
      linkedin_url: "https://www.linkedin.com/in/beatriz-exemplo",
      notes: "Prefere contato por e-mail",
      is_primary: true,
    });

    expect(contact).toMatchObject({
      client_id: clientId,
      full_name: "Beatriz Lima",
      job_title: "CTO",
      email: "beatriz@example.com",
      phone: "+55 11 3000-1000",
      mobile: "+55 11 90000-1000",
      birthday: "1990-02-03",
      linkedin_url: "https://www.linkedin.com/in/beatriz-exemplo",
      notes: "Prefere contato por e-mail",
      is_primary: 1,
    });

    const listed = (await listContacts("Beatriz", null))[0];
    expect(listed).toMatchObject({
      full_name: "Beatriz Lima",
      company_name: "Verde Vivo S.A.",
      is_primary: true,
    });
  });

  it("grava campos opcionais vazios como nulos e mantém is_primary falso", async () => {
    const clientId = companyId("Aurora Tecnologia Ltda.");
    const contact = await createContact({
      client_id: clientId,
      full_name: "Sem Extras",
      job_title: "",
      email: "",
      phone: "",
      mobile: "",
      birthday: "",
      linkedin_url: "",
      notes: "",
      is_primary: false,
    });

    expect(contact).toMatchObject({
      job_title: null,
      email: null,
      phone: null,
      mobile: null,
      birthday: null,
      linkedin_url: null,
      notes: null,
      is_primary: 0,
    });
  });

  it("não cria contato para cliente inativo", async () => {
    const clientId = companyId("Verde Vivo S.A.");
    await deactivateClient(clientId);
    const totalBefore = contactCount();

    await expect(
      createContact({ client_id: clientId, full_name: "Cliente Inativo" }),
    ).resolves.toBeUndefined();
    expect(contactCount()).toBe(totalBefore);
  });

  it("não insere linha quando o cliente não existe", async () => {
    const totalBefore = contactCount();

    await expect(
      createContact({ client_id: "missing", full_name: "Fantasma" }),
    ).resolves.toBeUndefined();
    expect(contactCount()).toBe(totalBefore);
  });
});

describe("getContact", () => {
  function contactId(fullName: string) {
    return (
      getDb()
        .prepare("SELECT id FROM contacts WHERE full_name = ?")
        .get(fullName) as { id: string }
    ).id;
  }

  it("retorna o contato com dados da empresa e is_primary booleano", async () => {
    const id = contactId("Mariana Costa");

    const contact = await getContact(id);

    expect(contact).toMatchObject({
      id,
      full_name: "Mariana Costa",
      job_title: "Diretora",
      email: "mariana@example.com",
      company_name: "Aurora Tecnologia Ltda.",
      trade_name: "Aurora",
      industry: "Tecnologia da Informação",
      is_primary: true,
    });
    expect(typeof contact!.is_primary).toBe("boolean");
  });

  it("retorna is_primary falso para contato não principal", async () => {
    const id = contactId("Rafael Mendes");

    const contact = await getContact(id);

    expect(contact).toMatchObject({ full_name: "Rafael Mendes", is_primary: false });
    expect(typeof contact!.is_primary).toBe("boolean");
  });

  it("retorna undefined para contato inexistente", async () => {
    await expect(getContact("missing-contact")).resolves.toBeUndefined();
  });
});

describe("updateContact", () => {
  function contactId(fullName: string) {
    return (
      getDb()
        .prepare("SELECT id FROM contacts WHERE full_name = ?")
        .get(fullName) as { id: string }
    ).id;
  }

  function companyId(companyName: string) {
    return (
      getDb()
        .prepare("SELECT id FROM clients WHERE company_name = ?")
        .get(companyName) as { id: string }
    ).id;
  }

  it("atualiza todos os campos, normaliza o nome e preserva o cliente original", async () => {
    const id = contactId("Rafael Mendes");
    const originalClientId = companyId("Aurora Tecnologia Ltda.");
    const otherClientId = companyId("Verde Vivo S.A.");
    getDb()
      .prepare(
        "UPDATE contacts SET created_at = ?, updated_at = ? WHERE id = ?",
      )
      .run("2020-01-01T00:00:00.000Z", "2020-01-01T00:00:00.000Z", id);

    const updated = await updateContact(id, {
      client_id: otherClientId,
      full_name: "  Rafael Mendes Silva  ",
      job_title: "Head de Engenharia",
      email: "rafael.silva@example.com",
      phone: "(11) 3333-1000",
      mobile: "(11) 91234-5678",
      birthday: "1985-07-09",
      linkedin_url: "https://www.linkedin.com/in/rafael-exemplo",
      notes: "Prefere contato por telefone",
      is_primary: true,
    });

    expect(updated).toMatchObject({
      id,
      client_id: originalClientId,
      full_name: "Rafael Mendes Silva",
      job_title: "Head de Engenharia",
      email: "rafael.silva@example.com",
      phone: "(11) 3333-1000",
      mobile: "(11) 91234-5678",
      birthday: "1985-07-09",
      linkedin_url: "https://www.linkedin.com/in/rafael-exemplo",
      notes: "Prefere contato por telefone",
      is_primary: true,
    });
    expect(updated!.is_primary).toBe(true);
    expect(updated!.created_at).toBe("2020-01-01T00:00:00.000Z");
    expect(updated!.updated_at).not.toBe("2020-01-01T00:00:00.000Z");
    expect(updated!.updated_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );

    const reloaded = await getContact(id);
    expect(reloaded).toMatchObject({
      client_id: originalClientId,
      company_name: "Aurora Tecnologia Ltda.",
      full_name: "Rafael Mendes Silva",
      is_primary: true,
    });
  });

  it("grava campos opcionais vazios como nulos e desmarca o contato principal", async () => {
    const id = contactId("Mariana Costa");

    const updated = await updateContact(id, {
      full_name: "  Mariana Costa  ",
      job_title: "",
      email: "",
      phone: "",
      mobile: "",
      birthday: "",
      linkedin_url: "",
      notes: "",
      is_primary: false,
    });

    expect(updated).toMatchObject({
      full_name: "Mariana Costa",
      job_title: null,
      email: null,
      phone: null,
      mobile: null,
      birthday: null,
      linkedin_url: null,
      notes: null,
      is_primary: false,
    });

    const row = getDb()
      .prepare("SELECT is_primary FROM contacts WHERE id = ?")
      .get(id) as { is_primary: number };
    expect(row.is_primary).toBe(0);
  });

  it("retorna undefined e não altera dados para contato inexistente", async () => {
    const totalBefore = (
      getDb().prepare("SELECT COUNT(*) AS total FROM contacts").get() as {
        total: number;
      }
    ).total;

    await expect(
      updateContact("missing-contact", { full_name: "Fantasma", is_primary: true }),
    ).resolves.toBeUndefined();
    expect(
      (getDb().prepare("SELECT COUNT(*) AS total FROM contacts").get() as {
        total: number;
      }).total,
    ).toBe(totalBefore);
  });
});
