import test from "node:test";
import assert from "node:assert/strict";
import { getDashboardDate, getGreeting } from "../src/lib/greeting.mjs";

test("seleciona a saudação pelo horário de Brasília, sem depender do fuso do servidor", () => {
  assert.match(getGreeting(new Date("2025-02-01T14:59:00Z")), /, Djardi$/); // 11:59
  assert.match(getGreeting(new Date("2025-02-01T15:00:00Z")), /, Djardi$/); // 12:00
  assert.match(getGreeting(new Date("2025-02-01T20:59:00Z")), /, Djardi$/); // 17:59
  assert.match(getGreeting(new Date("2025-02-01T21:00:00Z")), /, Djardi$/); // 18:00
  assert.equal(getGreeting(new Date("2025-02-01T15:00:00Z"), "Ana").endsWith(", Ana"), true);
});

test("varia diariamente entre saudações comuns e religiosas, incluindo a paz de Cristo", () => {
  const options = new Set(Array.from({ length: 366 }, (_, day) => getGreeting(new Date(Date.UTC(2025, 0, day + 1, 15)) )));
  assert.ok(options.size > 10);
  assert.ok([...options].some((greeting) => greeting.startsWith("A paz de Cristo")));
  assert.ok([...options].some((greeting) => greeting.startsWith("Bom dia") || greeting.startsWith("Boa tarde") || greeting.startsWith("Boa noite")));
});

test("formata a data atual em português pelo fuso de Brasília", () => {
  assert.equal(getDashboardDate(new Date("2025-02-01T02:00:00Z")), "SEXTA-FEIRA, 31 DE JANEIRO");
  assert.equal(getDashboardDate(new Date("2025-02-01T15:00:00Z")), "SÁBADO, 1 DE FEVEREIRO");
});
