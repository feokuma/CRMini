import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { prepareStandalone } =
  require("../../scripts/prepare-standalone.cjs") as {
    prepareStandalone: (options: { root: string }) => string;
  };

const temps: string[] = [];

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crm-standalone-"));
  temps.push(root);
  return root;
}

afterEach(() => {
  for (const dir of temps.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function write(root: string, rel: string, content = "fixture") {
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}

// Monta a árvore mínima de um build `next build` (output: standalone) para o
// script copiar. O banco do usuário (crm.sqlite) nunca deve entrar no standalone.
function buildFixture() {
  const root = tempRoot();
  write(root, ".next/standalone/server.js", "// entrypoint");
  write(root, ".next/static/css/app.css", "/* css */");
  write(root, "public/favicon.ico", "ico");
  write(root, "database/init.sql", "-- schema");
  write(root, "database/migrate.cjs", "// migrate");
  write(root, "database/migrations/001_contacts_soft_delete.sql", "-- m1");
  write(root, "database/crm.sqlite", "nao copiar");
  write(root, "node_modules/better-sqlite3/build/Release/better_sqlite3.node", "node");
  return root;
}

function standalone(root: string, rel: string) {
  return path.join(root, ".next", "standalone", rel);
}

describe("prepareStandalone", () => {
  it("copia todos os alvos para o standalone", () => {
    const root = buildFixture();

    const result = prepareStandalone({ root });

    expect(result).toBe(path.join(root, ".next", "standalone"));
    expect(fs.readFileSync(standalone(root, ".next/static/css/app.css"), "utf8")).toBe(
      "/* css */",
    );
    expect(fs.readFileSync(standalone(root, "public/favicon.ico"), "utf8")).toBe(
      "ico",
    );
    expect(fs.readFileSync(standalone(root, "database/init.sql"), "utf8")).toBe(
      "-- schema",
    );
    expect(fs.readFileSync(standalone(root, "database/migrate.cjs"), "utf8")).toBe(
      "// migrate",
    );
    expect(
      fs.readFileSync(
        standalone(root, "database/migrations/001_contacts_soft_delete.sql"),
        "utf8",
      ),
    ).toBe("-- m1");
    expect(
      fs.readFileSync(
        standalone(root, "node_modules/better-sqlite3/build/Release/better_sqlite3.node"),
        "utf8",
      ),
    ).toBe("node");
  });

  it("não copia arquivos .sqlite para o standalone", () => {
    const root = buildFixture();

    prepareStandalone({ root });

    expect(fs.existsSync(standalone(root, "database/crm.sqlite"))).toBe(false);
  });

  it("é idempotente: rodar duas vezes não duplica nem falha", () => {
    const root = buildFixture();

    prepareStandalone({ root });
    expect(() => prepareStandalone({ root })).not.toThrow();

    const css = standalone(root, ".next/static/css/app.css");
    expect(fs.readFileSync(css, "utf8")).toBe("/* css */");
    // A pasta estática não deve ganhar uma cópia aninhada ao rodar de novo.
    expect(fs.readdirSync(path.dirname(css)).sort()).toEqual(["app.css"]);
  });

  it("falha com erro claro quando server.js não existe, sem criar nada", () => {
    const root = tempRoot();
    // Apenas recursos de entrada, sem o standalone/server.js.
    write(root, ".next/static/css/app.css", "/* css */");
    write(root, "public/favicon.ico", "ico");

    expect(() => prepareStandalone({ root })).toThrow(
      /Standalone ausente: rode `npm run build`/,
    );
    expect(fs.existsSync(path.join(root, ".next", "standalone"))).toBe(false);
  });
});
