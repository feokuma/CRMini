import test from "node:test";
import assert from "node:assert/strict";
import { formatBrazilDate, formatBrazilDateTime, getBrazilDateString, toProjectHours } from "../src/lib/project-time.mjs";

test("converte duração em horas com 8h/dia, 5 dias/semana e 20 dias/mês", () => {
  assert.equal(toProjectHours(2, "hours"), 2);
  assert.equal(toProjectHours(3, "days"), 24);
  assert.equal(toProjectHours(2, "weeks"), 80);
  assert.equal(toProjectHours(1, "months"), 160);
});

test("preserva duração zero e vazio opcional", () => {
  assert.equal(toProjectHours(0, "days"), 0);
  assert.equal(toProjectHours("", "days"), null);
});

test("rejeita duração inválida ou negativa", () => {
  assert.throws(() => toProjectHours(-1, "days"), RangeError);
  assert.throws(() => toProjectHours("abc", "hours"), RangeError);
});

test("formata a data no fuso de Brasília, inclusive perto da virada UTC", () => {
  assert.equal(getBrazilDateString(new Date("2025-01-10T01:30:00Z")), "2025-01-09");
  assert.equal(getBrazilDateString(new Date("2025-01-10T03:30:00Z")), "2025-01-10");
});

test("exibe datas e horários no padrão brasileiro", () => {
  assert.equal(formatBrazilDate("2025-01-09"), "09/01/2025");
  assert.equal(formatBrazilDateTime("2025-01-10T01:30:00Z"), "09/01/2025, 22:30");
});
