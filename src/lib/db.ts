import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { normalizeSearch } from "@/lib/normalize-search";
import { phoneDigits } from "@/lib/phone";

const databaseDir = path.join(process.cwd(), "database");
const paths =
  require("../../database/sqlite-paths.cjs") as typeof import("../../database/sqlite-paths.cjs");
const defaultDatabaseFile = paths.defaultDatabasePath();
const schemaFile = path.join(databaseDir, "init.sql");

const globalForDb = globalThis as unknown as { crmSqlite?: Database.Database };

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
  sqlite.function("normalize", normalizeSearch);
  sqlite.function("phone_digits", phoneDigits);
  sqlite.pragma("journal_mode = WAL");
  // O SQLite só verifica chaves estrangeiras quando habilitadas por conexão.
  sqlite.pragma("foreign_keys = ON");
  // Substitui o entrypoint do PostgreSQL: schema idempotente aplicado na
  // primeira conexão, sem etapa manual para um banco novo.
  sqlite.exec(fs.readFileSync(schemaFile, "utf8"));
  return sqlite;
}

export function getDb(): Database.Database {
  if (!globalForDb.crmSqlite) {
    globalForDb.crmSqlite = openDatabase();
  }
  return globalForDb.crmSqlite;
}
