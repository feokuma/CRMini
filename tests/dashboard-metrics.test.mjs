import test from "node:test";
import assert from "node:assert/strict";
import { getDashboardMetrics } from "../src/lib/dashboard-metrics.mjs";

test("calcula contagens, oportunidades abertas, conversão sobre encerradas e subtotais por moeda", async () => {
  let sql = "";
  const metrics = await getDashboardMetrics(async (statement) => {
    sql = statement;
    return { rows: [{ contacts_count: 10, opportunities_count: 8, open_opportunities_count: 5, won_count: 2, lost_count: 1, open_value_by_currency: { BRL: "1500.00", USD: "300.00" } }] };
  });

  assert.deepEqual(metrics, { contactsCount: 10, opportunitiesCount: 8, openOpportunitiesCount: 5, conversionRate: 67, openValueByCurrency: { BRL: "1500.00", USD: "300.00" } });
  assert.match(sql, /FROM contacts/);
  assert.match(sql, /status NOT IN \('Ganha', 'Perdida'\)/);
  assert.match(sql, /GROUP BY currency/);
});

test("conversão é zero quando não há oportunidades encerradas", async () => {
  const metrics = await getDashboardMetrics(async () => ({ rows: [{ contacts_count: 0, opportunities_count: 0, open_opportunities_count: 0, won_count: 0, lost_count: 0, open_value_by_currency: {} }] }));
  assert.equal(metrics.conversionRate, 0);
  assert.deepEqual(metrics.openValueByCurrency, {});
});

test("propaga falha de banco para a tela lidar", async () => {
  await assert.rejects(getDashboardMetrics(async () => { throw new Error("banco indisponível"); }), /banco indisponível/);
});
