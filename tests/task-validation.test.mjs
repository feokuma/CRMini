import test from "node:test";
import assert from "node:assert/strict";
import { validateTask } from "../src/lib/task-validation.mjs";

const valid = { contact_type: "email", subject: "Retorno", scheduled_at: "2026-10-09T14:00:00-03:00", client_id: "id", contact_id: "contact" };
test("aceita tarefa com campos válidos e descrição opcional", () => assert.equal(validateTask(valid), null));
test("rejeita tipo, assunto, data, associação ausente e conteúdo fora dos limites", () => {
  for (const change of [{ contact_type: "fax" }, { subject: " " }, { scheduled_at: "amanhã" }, { client_id: null }, { description: "x".repeat(5001) }]) assert.ok(validateTask({ ...valid, ...change }));
});
