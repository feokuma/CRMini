// Aplica database/seed.sql ao banco SQLite local. Pode ser executado mais de
// uma vez: os registros de demonstração usam ON CONFLICT (id) DO UPDATE.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Sem .env.local, usa o caminho padrão abaixo.
}

const databaseDir = path.join(process.cwd(), "database");
const filename = process.env.SQLITE_PATH || path.join(databaseDir, "crm.sqlite");

if (filename !== ":memory:") {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
}

const db = new Database(filename);
db.pragma("foreign_keys = ON");
db.exec(fs.readFileSync(path.join(databaseDir, "init.sql"), "utf8"));
db.exec(fs.readFileSync(path.join(databaseDir, "seed.sql"), "utf8"));
db.close();

console.log(`Seed aplicado em ${filename}`);
