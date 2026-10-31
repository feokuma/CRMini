import { describe, expect, it } from "vitest";
import { getDashboardDate, getGreeting } from "./greeting";

const commonGreetingPrefixPattern = /^(Bom dia|Boa tarde|Boa noite)/;

describe("getGreeting", () => {
  it("seleciona a saudação pelas faixas horárias de São Paulo", () => {
    // 2025-02-04 seleciona o primeiro item de cada faixa (dia % 12 === 0).
    expect(getGreeting(new Date("2025-02-04T14:59:00Z"))).toBe("Bom dia");
    expect(getGreeting(new Date("2025-02-04T15:00:00Z"))).toBe("Boa tarde");
    expect(getGreeting(new Date("2025-02-04T20:59:00Z"))).toBe("Boa tarde");
    expect(getGreeting(new Date("2025-02-04T21:00:00Z"))).toBe("Boa noite");
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

describe("getGreeting com nome", () => {
  const fixedDate = new Date("2025-02-01T15:00:00Z");
  const greetingWithoutName = getGreeting(fixedDate);

  it("não adiciona sufixo quando o nome está ausente ou vazio", () => {
    expect(getGreeting(fixedDate)).toBe(greetingWithoutName);
    for (const name of [null, undefined, "", "   ", "\t\n"]) {
      expect(getGreeting(fixedDate, name)).toBe(greetingWithoutName);
    }
  });

  it("adiciona o nome trimado como sufixo quando informado", () => {
    expect(getGreeting(fixedDate, "Ana")).toBe(`${greetingWithoutName}, Ana`);
    expect(getGreeting(fixedDate, "  Ana  ")).toBe(
      `${greetingWithoutName}, Ana`,
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
