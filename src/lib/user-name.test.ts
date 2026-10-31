import { describe, expect, it } from "vitest";
import {
  MAX_USER_NAME_LENGTH,
  normalizeUserName,
  validateUserName,
} from "./user-name";

const invalidNameMessage = "Nome do usuário inválido.";
const maxLengthMessage = "O nome do usuário deve ter no máximo 80 caracteres.";

describe("normalizeUserName", () => {
  it("colapsa espaços internos e remove espaços das pontas", () => {
    expect(normalizeUserName("  Maria   Clara  ")).toBe("Maria Clara");
    expect(normalizeUserName("Ana\tBeatriz\nLima")).toBe("Ana Beatriz Lima");
  });

  it("devolve string vazia para entrada vazia ou só de espaços", () => {
    expect(normalizeUserName("")).toBe("");
    expect(normalizeUserName("   \t\n ")).toBe("");
  });
});

describe("validateUserName", () => {
  it("aceita vazio, só espaços e exatamente 80 caracteres", () => {
    expect(validateUserName("")).toBeNull();
    expect(validateUserName("   ")).toBeNull();
    expect(validateUserName("a".repeat(MAX_USER_NAME_LENGTH))).toBeNull();
  });

  it("rejeita nomes acima do limite com a mensagem exata", () => {
    expect(validateUserName("a".repeat(MAX_USER_NAME_LENGTH + 1))).toBe(
      maxLengthMessage,
    );
  });

  it("mede o limite pelo nome normalizado", () => {
    expect(
      validateUserName("  " + "a".repeat(MAX_USER_NAME_LENGTH) + "  "),
    ).toBeNull();
    expect(
      validateUserName("  " + "a".repeat(MAX_USER_NAME_LENGTH + 1) + "  "),
    ).toBe(maxLengthMessage);
  });

  it.each([undefined, null, 42, {}, ["Ana"]])(
    "rejeita valor que não é string",
    (value) => {
      expect(validateUserName(value)).toBe(invalidNameMessage);
    },
  );
});
