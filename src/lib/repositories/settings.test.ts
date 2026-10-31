import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SQLITE_PATH = ":memory:";
});

import { getDb } from "@/lib/db";
import { getUserName, saveUserName } from "./settings";

function storedRows() {
  return getDb()
    .prepare("SELECT key, value FROM app_settings ORDER BY key")
    .all();
}

beforeEach(() => {
  getDb().exec("DELETE FROM app_settings");
});

describe("settings", () => {
  it("devolve null quando o nome do usuário não está configurado", async () => {
    await expect(getUserName()).resolves.toBeNull();
    expect(storedRows()).toEqual([]);
  });

  it("salva e lê o nome do usuário", async () => {
    await saveUserName("Ana");

    await expect(getUserName()).resolves.toBe("Ana");
    expect(storedRows()).toEqual([{ key: "user_name", value: "Ana" }]);
  });

  it("sobrescreve o nome existente sem duplicar a chave", async () => {
    await saveUserName("Ana");
    await saveUserName("Beatriz");

    await expect(getUserName()).resolves.toBe("Beatriz");
    expect(storedRows()).toEqual([{ key: "user_name", value: "Beatriz" }]);
  });

  it("remove o nome quando salvo como null ou string vazia", async () => {
    await saveUserName("Ana");
    await saveUserName(null);
    await expect(getUserName()).resolves.toBeNull();

    await saveUserName("Beatriz");
    await saveUserName("");
    await expect(getUserName()).resolves.toBeNull();
    expect(storedRows()).toEqual([]);
  });

  it("armazena apóstrofo e aspas literalmente, sem interpretar SQL", async () => {
    const literalName = `D'Ávila "Teste"`;

    await saveUserName(literalName);

    await expect(getUserName()).resolves.toBe(literalName);
    expect(storedRows()).toEqual([{ key: "user_name", value: literalName }]);
  });
});
