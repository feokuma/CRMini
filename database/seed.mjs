// Aplica database/seed.sql ao banco SQLite local. Pode ser executado mais de
// uma vez: os registros de demonstração usam ON CONFLICT (id) DO UPDATE.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import migrations from "./migrate.cjs";
import paths from "./sqlite-paths.cjs";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Sem .env.local, usa o caminho padrão abaixo.
}

const databaseDir = path.join(process.cwd(), "database");
const { defaultDatabasePath, migrateLegacyDatabase, shouldMigrateLegacy } =
  paths;
const { runMigrationsFile } = migrations;
const filename = defaultDatabasePath();

if (filename !== ":memory:") {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  if (shouldMigrateLegacy())
    await migrateLegacyDatabase(path.join(databaseDir, "crm.sqlite"), filename);
}

const summary = runMigrationsFile({
  databasePath: filename,
  migrationsDir: path.join(databaseDir, "migrations"),
  schemaFile: path.join(databaseDir, "init.sql"),
});

const db = new Database(filename);
db.pragma("foreign_keys = ON");
db.exec(fs.readFileSync(path.join(databaseDir, "seed.sql"), "utf8"));
db.close();

let resumo = "sem migrations pendentes";
if (summary.isNew) resumo = "banco novo com schema de init.sql";
else if (summary.applied.length > 0)
  resumo = `migrations aplicadas: ${summary.applied.join(", ")}`;
else if (summary.adopted.length > 0)
  resumo = `migrations adotadas: ${summary.adopted.join(", ")}`;
console.log(`Seed aplicado em ${filename} (${resumo}).`);
