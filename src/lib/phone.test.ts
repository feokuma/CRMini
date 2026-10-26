import { describe, expect, it } from "vitest";
import {
  formatPhone,
  formatPhoneForDisplay,
  phoneDigits,
} from "./phone";

function typePhone(value: string): string[] {
  let masked = "";
  const snapshots: string[] = [];

  for (const character of value) {
    masked = formatPhone(`${masked}${character}`);
    snapshots.push(masked);
  }

  return snapshots;
}

describe("formatPhone", () => {
  it("retorna vazio para valores ausentes ou em branco", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone("   ")).toBe("");
    expect(formatPhone(null)).toBe("");
    expect(formatPhone(undefined)).toBe("");
  });

  it.each([
    ["1", "(1"],
    ["11", "(11"],
    ["113", "(11) 3"],
    ["1133", "(11) 33"],
    ["11333", "(11) 333"],
    ["113333", "(11) 3333"],
    ["1133331", "(11) 3333-1"],
    ["11333310", "(11) 3333-10"],
    ["113333100", "(11) 3333-100"],
    ["1133331000", "(11) 3333-1000"],
    ["11912345678", "(11) 91234-5678"],
  ])("formata progressivamente %s dígitos como %s", (digits, expected) => {
    expect(formatPhone(digits)).toBe(expected);
  });

  it("formata telefone fixo e celular completos", () => {
    expect(formatPhone("1133331000")).toBe("(11) 3333-1000");
    expect(formatPhone("11912345678")).toBe("(11) 91234-5678");
  });

  it("remove máscara e caracteres não numéricos da entrada", () => {
    expect(formatPhone("(11) 3333-1000")).toBe("(11) 3333-1000");
    expect(formatPhone("(11) 91234-5678")).toBe("(11) 91234-5678");
    expect(formatPhone(" 11 91234 5678 ")).toBe("(11) 91234-5678");
  });

  it("trunca a entrada em 11 dígitos", () => {
    expect(formatPhone("119123456789999")).toBe("(11) 91234-5678");
    expect(formatPhone("(11) 91234-5678 0000")).toBe("(11) 91234-5678");
  });

  it("permite digitar o telefone local caractere a caractere", () => {
    expect(typePhone("11912345678")).toEqual([
      "(1",
      "(11",
      "(11) 9",
      "(11) 91",
      "(11) 912",
      "(11) 9123",
      "(11) 9123-4",
      "(11) 9123-45",
      "(11) 9123-456",
      "(11) 9123-4567",
      "(11) 91234-5678",
    ]);
  });

  it("preserva e formata números com o prefixo +55", () => {
    expect(formatPhone("+55 11 3333-1000")).toBe("+55 (11) 3333-1000");
    expect(formatPhone("+55 (11) 91234-5678")).toBe("+55 (11) 91234-5678");
    expect(formatPhone("+5511912345678")).toBe("+55 (11) 91234-5678");
    expect(formatPhone("+55 11 91234-5678 0000")).toBe(
      "+55 (11) 91234-5678",
    );
  });

  it("permite digitar o prefixo +55 caractere a caractere", () => {
    expect(typePhone("+5511912345678")).toEqual([
      "+",
      "+5",
      "+55",
      "+55 (1",
      "+55 (11",
      "+55 (11) 9",
      "+55 (11) 91",
      "+55 (11) 912",
      "+55 (11) 9123",
      "+55 (11) 9123-4",
      "+55 (11) 9123-45",
      "+55 (11) 9123-456",
      "+55 (11) 9123-4567",
      "+55 (11) 91234-5678",
    ]);
  });

  it("mantém o + enquanto não há dígitos e o prefixo +55 sem dígitos", () => {
    expect(formatPhone("+")).toBe("+");
    expect(formatPhone("+ ")).toBe("+");
    expect(formatPhone("+55")).toBe("+55");
    expect(formatPhone("+55 ")).toBe("+55");
  });

  it("preserva valores legados que não seguem a máscara", () => {
    expect(formatPhone("ramal 123")).toBe("ramal 123");
    expect(formatPhone("  ramal 123  ")).toBe("ramal 123");
    expect(formatPhone("+1 (555) 123-4567 ramal 9")).toBe(
      "+1 (555) 123-4567 ramal 9",
    );
    expect(formatPhone("+55 abc")).toBe("+55 abc");
    expect(formatPhone("abc")).toBe("abc");
    expect(formatPhone("(")).toBe("");
    expect(formatPhone(")")).toBe("");
    expect(formatPhone("-")).toBe("");
  });

  it("preserva números iniciados em 0, como 0800", () => {
    expect(formatPhone("0800 123 4567")).toBe("0800 123 4567");
    expect(formatPhone("08001234567")).toBe("08001234567");
  });

  it("preserva números internacionais que não sejam +55", () => {
    expect(formatPhone("+1 (555) 123-4567")).toBe("+1 (555) 123-4567");
    expect(formatPhone("+351 912 345 678")).toBe("+351 912 345 678");
  });
});

describe("formatPhoneForDisplay", () => {
  it("retorna vazio para valores ausentes ou em branco", () => {
    expect(formatPhoneForDisplay("")).toBe("");
    expect(formatPhoneForDisplay("   ")).toBe("");
    expect(formatPhoneForDisplay(null)).toBe("");
    expect(formatPhoneForDisplay(undefined)).toBe("");
  });

  it.each([
    ["11912345678", "(11) 91234-5678"],
    ["1133331000", "(11) 3333-1000"],
    ["(11) 3333-1000", "(11) 3333-1000"],
    ["  11912345678  ", "(11) 91234-5678"],
    ["+55 11 3333-1000", "+55 (11) 3333-1000"],
    ["+5511912345678", "+55 (11) 91234-5678"],
  ])("formata o valor completo %s como %s", (value, expected) => {
    expect(formatPhoneForDisplay(value)).toBe(expected);
  });

  it.each([
    ["3333-1000"],
    ["113333100"],
    ["0800 123 4567"],
    ["ramal 123"],
    ["+1 (555) 123-4567 ramal 9"],
    ["+1 (555) 123-4567"],
    ["+351 912 345 678"],
    ["+55"],
    ["+55 abc"],
  ])("preserva o valor ambíguo %s", (value) => {
    expect(formatPhoneForDisplay(value)).toBe(value);
  });
});

describe("phoneDigits", () => {
  it("extrai apenas os dígitos do valor", () => {
    expect(phoneDigits("(11) 91234-5678")).toBe("11912345678");
    expect(phoneDigits("+55 (11) 91234-5678")).toBe("5511912345678");
    expect(phoneDigits("ramal 123")).toBe("123");
  });

  it("retorna vazio para valores ausentes ou sem dígitos", () => {
    expect(phoneDigits(null)).toBe("");
    expect(phoneDigits(undefined)).toBe("");
    expect(phoneDigits("")).toBe("");
    expect(phoneDigits("abc")).toBe("");
  });
});
