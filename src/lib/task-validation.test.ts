import { describe, expect, it } from "vitest";
import { validateTask } from "./task-validation";

const validTask = {
  contact_type: "email",
  subject: "Retornar proposta",
  scheduled_at: "2026-10-09T14:00:00-03:00",
  client_id: "client-id",
  contact_id: "contact-id",
};

describe("validateTask", () => {
  it.each(["email", "telefone", "compromisso"])("aceita o tipo %s", (contact_type) => {
    expect(validateTask({ ...validTask, contact_type })).toBeNull();
  });

  it("aceita descrição ausente ou opcional dentro do limite", () => {
    expect(validateTask(validTask)).toBeNull();
    expect(validateTask({ ...validTask, description: "" })).toBeNull();
    expect(validateTask({ ...validTask, description: "x".repeat(5000) })).toBeNull();
  });

  it.each([
    ["tipo desconhecido", { contact_type: "fax" }],
    ["assunto não textual", { subject: 7 }],
    ["assunto vazio", { subject: "  " }],
    ["assunto acima do limite", { subject: "x".repeat(201) }],
    ["cliente ausente", { client_id: null }],
    ["contato ausente", { contact_id: undefined }],
    ["data sem fuso", { scheduled_at: "2026-10-09T14:00" }],
    ["data impossível", { scheduled_at: "2026-02-30T14:00:00Z" }],
    ["descrição de tipo inválido", { description: 5 }],
    ["descrição acima do limite", { description: "x".repeat(5001) }],
  ] as const)("rejeita %s", (_case, change) => {
    expect(validateTask({ ...validTask, ...change })).not.toBeNull();
  });
});
