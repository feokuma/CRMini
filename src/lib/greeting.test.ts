import { describe, expect, it } from "vitest";
import { getDashboardDate, getGreeting } from "./greeting";

const greetingNameSuffixPattern = /, Djardi$/;
const commonGreetingPrefixPattern = /^(Bom dia|Boa tarde|Boa noite)/;

describe("getGreeting", () => {
  it("seleciona a saudação pelas faixas horárias de São Paulo", () => {
    const beforeNoon = getGreeting(new Date("2025-02-01T14:59:00Z"));
    const noon = getGreeting(new Date("2025-02-01T15:00:00Z"));
    const beforeEvening = getGreeting(new Date("2025-02-01T20:59:00Z"));
    const evening = getGreeting(new Date("2025-02-01T21:00:00Z"));

    expect(greetingNameSuffixPattern.test(beforeNoon)).toBe(true);
    expect(greetingNameSuffixPattern.test(noon)).toBe(true);
    expect(greetingNameSuffixPattern.test(beforeEvening)).toBe(true);
    expect(greetingNameSuffixPattern.test(evening)).toBe(true);
    expect(
      getGreeting(new Date("2025-02-01T15:00:00Z"), "Ana").endsWith(", Ana"),
    ).toBe(true);
  });

  it("varia diariamente entre saudações comuns e religiosas", () => {
    const greetings = Array.from({ length: 366 }, (_, day) => {
      const timestamp = Date.UTC(2025, 0, day + 1, 15);

      return getGreeting(new Date(timestamp));
    });
    const uniqueGreetings = new Set(greetings);

    expect(uniqueGreetings.size).toBeGreaterThan(10);
    expect(
      greetings.some((greeting) => greeting.startsWith("A paz de Cristo")),
    ).toBe(true);
    expect(
      greetings.some((greeting) => commonGreetingPrefixPattern.test(greeting)),
    ).toBe(true);
    expect(getGreeting(new Date("2025-02-01T15:00:00Z"))).toBe(
      getGreeting(new Date("2025-02-01T15:00:00Z")),
    );
  });
});

describe("getDashboardDate", () => {
  it("formata a data em português no fuso de São Paulo", () => {
    expect(getDashboardDate(new Date("2025-02-01T02:00:00Z"))).toBe(
      "SEXTA-FEIRA, 31 DE JANEIRO",
    );
    expect(getDashboardDate(new Date("2025-02-01T15:00:00Z"))).toBe(
      "SÁBADO, 1 DE FEVEREIRO",
    );
  });
});
