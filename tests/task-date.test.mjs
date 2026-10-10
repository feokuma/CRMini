import test from "node:test";
import assert from "node:assert/strict";
import { saoPauloDayRange } from "../src/lib/task-date.mjs";

test("gera limites de dia no fuso de São Paulo", () => {
  assert.deepEqual(saoPauloDayRange("2026-10-09"), { start: "2026-10-09T03:00:00.000Z", end: "2026-10-10T03:00:00.000Z" });
});

test("rejeita data inválida", () => assert.throws(() => saoPauloDayRange("2026-02-30")));
