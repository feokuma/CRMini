import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { normalizeSearch } from "@/lib/normalize-search";

const databaseDir = path.join(process.cwd(), "database");
const defaultDatabaseFile = path.join(databaseDir, "crm.sqlite");
const schemaFile = path.join(databaseDir, "init.sql");

const globalForDb = globalThis as unknown as { crmSqlite?: Database.Database };

function openDatabase(): Database.Database {
  const filename = process.env.SQLITE_PATH || defaultDatabaseFile;
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }
  const sqlite = new Database(filename);
  sqlite.function("normalize", normalizeSearch);
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
