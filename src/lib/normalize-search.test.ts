import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { normalizeSearch } from "./normalize-search";

describe("normalizeSearch", () => {
  it("remove marcas diacríticas, normaliza caixa e trata valores vazios", () => {
    expect(normalizeSearch("JOSÉ São Paulo")).toBe("jose sao paulo");
    expect(normalizeSearch("")).toBe("");
    expect(normalizeSearch(null)).toBeNull();
  });

  it("está registrada na conexão SQLite compartilhada", () => {
    expect(getDb().prepare("SELECT normalize(?) AS value").get("JOSÉ")).toEqual(
      { value: "jose" },
    );
  });
});
