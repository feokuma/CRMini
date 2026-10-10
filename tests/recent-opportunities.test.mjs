import test from "node:test";
import assert from "node:assert/strict";
import { getRecentOpportunities } from "../src/lib/recent-opportunities.mjs";

test("carrega do banco os campos da oportunidade e retorna linhas na ordem recente limitada", async () => {
  const rows = [{ id: "opp-1", name: "Implantação", company_name: "Empresa Exemplo", contact_name: "Contato Teste", status: "Proposta", value: "1200.00", currency: "BRL", updated_at: "2025-01-01" }];
  let sqlReceived = "";
  const actual = await getRecentOpportunities(async (sql) => {
    sqlReceived = sql;
    return { rows };
  });

  assert.deepEqual(actual, rows);
  assert.match(sqlReceived, /FROM opportunities o JOIN clients c/);
  assert.match(sqlReceived, /JOIN contacts p ON p\.id=o\.contact_id AND p\.client_id=o\.client_id/);
  assert.match(sqlReceived, /ORDER BY o\.created_at DESC LIMIT 4/);
});

test("retorna lista vazia quando ainda não há oportunidades", async () => {
  assert.deepEqual(await getRecentOpportunities(async () => ({ rows: [] })), []);
});

test("propaga falha na consulta para a página tratar", async () => {
  await assert.rejects(getRecentOpportunities(async () => { throw new Error("banco indisponível"); }), /banco indisponível/);
});
