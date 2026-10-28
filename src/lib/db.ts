import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { normalizeSearch } from "@/lib/normalize-search";
import { phoneDigits } from "@/lib/phone";

const databaseDir = path.join(
  process.env.CRM_RESOURCES_DIR || process.cwd(),
  "database",
);
const paths =
  require("../../database/sqlite-paths.cjs") as typeof import("../../database/sqlite-paths.cjs");
const migrations =
  require("../../database/migrate.cjs") as typeof import("../../database/migrate.cjs");
const defaultDatabaseFile = paths.defaultDatabasePath();
const schemaFile = path.join(databaseDir, "init.sql");
const migrationsDir = path.join(databaseDir, "migrations");

const globalForDb = globalThis as unknown as {
  crmSqlite?: Database.Database;
  migrationError?: Error;
};

function openDatabase(): Database.Database {
  const filename = defaultDatabaseFile;
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }
  if (filename !== ":memory:" && paths.shouldMigrateLegacy())
    paths.migrateLegacyDatabase(path.join(databaseDir, "crm.sqlite"), filename);
  const existed = filename === ":memory:" || fs.existsSync(filename);
  if (existed && filename !== ":memory:") paths.validateDatabase(filename);
  const sqlite = new Database(filename);
  try {
    sqlite.function("normalize", normalizeSearch);
    sqlite.function("phone_digits", phoneDigits);
    sqlite.pragma("journal_mode = WAL");
    // O SQLite só verifica chaves estrangeiras quando habilitadas por conexão.
    sqlite.pragma("foreign_keys = ON");
    // Aplica o schema de bancos novos e as migrations pendentes de bancos
    // existentes, com backup automático antes de alterar o arquivo.
    migrations.migrateDatabase(sqlite, {
      databasePath: filename,
      migrationsDir,
      schemaFile,
    });
    return sqlite;
  } catch (error) {
    sqlite.close();
    throw error;
  }
}

export function getDb(): Database.Database {
  // Depois de uma falha de migration é preciso reiniciar o processo: o erro
  // fica em cache para não abrir novas conexões nem gerar novos backups.
  if (globalForDb.migrationError) throw globalForDb.migrationError;
  if (!globalForDb.crmSqlite) {
    try {
      globalForDb.crmSqlite = openDatabase();
    } catch (error) {
      globalForDb.migrationError =
        error instanceof Error ? error : new Error(String(error));
      throw globalForDb.migrationError;
    }
  }
  return globalForDb.crmSqlite;
}
