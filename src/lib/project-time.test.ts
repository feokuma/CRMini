import { describe, expect, it } from "vitest";
import {
  formatBrazilDate,
  formatBrazilDateTime,
  getBrazilDateString,
  toProjectHours,
} from "./project-time";

describe("toProjectHours", () => {
  it.each([
    ["hours", 2, 2],
    ["days", 3, 24],
    ["weeks", 2, 80],
    ["months", 1, 160],
  ] as const)("converte %s em horas", (unit, amount, expected) => {
    expect(toProjectHours(amount, unit)).toBe(expected);
  });

  it("preserva zero e trata valores vazios como opcionais", () => {
    expect(toProjectHours(0, "days")).toBe(0);
    expect(toProjectHours("", "hours")).toBeNull();
    expect(toProjectHours(null, "hours")).toBeNull();
    expect(toProjectHours(undefined, "hours")).toBeNull();
  });

  it.each([-1, "abc", Number.NaN, Number.POSITIVE_INFINITY])(
    "rejeita valor inválido %s",
    (value) => {
      expect(() => toProjectHours(value, "hours")).toThrow(RangeError);
    },
  );
});

describe("datas no fuso de São Paulo", () => {
  it("calcula a data civil perto da virada UTC", () => {
    expect(getBrazilDateString(new Date("2025-01-10T01:30:00Z"))).toBe("2025-01-09");
    expect(getBrazilDateString(new Date("2025-01-10T03:30:00Z"))).toBe("2025-01-10");
  });

  it("formata datas civis sem aplicar deslocamento de fuso", () => {
    expect(formatBrazilDate("2025-01-09")).toBe("09/01/2025");
  });

  it("formata instantes no fuso de São Paulo e trata valores ausentes", () => {
    expect(formatBrazilDate("2025-01-10T01:30:00Z")).toBe("09/01/2025");
    expect(formatBrazilDateTime("2025-01-10T01:30:00Z")).toBe("09/01/2025, 22:30");
    expect(formatBrazilDate(null)).toBe("—");
    expect(formatBrazilDateTime(undefined)).toBe("—");
  });
});
