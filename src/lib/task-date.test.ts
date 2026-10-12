import { describe, expect, it } from "vitest";
import { saoPauloDayRange } from "./task-date";

describe("saoPauloDayRange", () => {
  it("retorna os limites UTC do dia civil em São Paulo", () => {
    expect(saoPauloDayRange("2026-10-09")).toEqual({
      start: "2026-10-09T03:00:00.000Z",
      end: "2026-10-10T03:00:00.000Z",
    });
  });

  it.each(["2026-02-30", "09-10-2026", "2026-1-09", ""]) (
    "rejeita a data civil inválida %j", (day) => {
      expect(() => saoPauloDayRange(day)).toThrow("Data inválida.");
    },
  );
});
