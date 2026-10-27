const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const { validateDatabase } = require("./sqlite-paths.cjs");

// Formato append-only: 001_nome_em_snake_case.sql.
const MIGRATION_PATTERN = /^(\d{3})_([a-z0-9_]+)\.sql$/;

const NOT_CRM_ERROR = "O arquivo selecionado não parece ser um banco do CRM.";
const BACKUP_BUSY_ERROR =
  "não foi possível criar o backup: o banco está em uso por outro processo; " +
  "feche outras instâncias e tente novamente";

const SCHEMA_MIGRATIONS_SQL = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`;

function readAppliedIf(sql) {
  // O marcador só vale na primeira linha do arquivo.
  const firstLine = sql.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0];
  const match = /^-- @applied-if:[ \t]*(.*)$/.exec(firstLine);
  if (!match) return null;
  const appliedIf = match[1].trim().replace(/;\s*$/, "").trim();
  if (!appliedIf) return null;
  if (!/^(select|with)\b/i.test(appliedIf)) {
    throw new Error(
      "@applied-if deve começar com SELECT ou WITH (consulta somente leitura).",
    );
  }
  return appliedIf;
}

function listMigrations(migrationsDir) {
  const files = fs.readdirSync(migrationsDir, { withFileTypes: true });
  const migrations = [];
  const seen = new Map();

  for (const file of files) {
    if (!file.isFile()) continue;
    const match = MIGRATION_PATTERN.exec(file.name);
    if (!match) continue;
    const [, version, name] = match;
    if (seen.has(version)) {
      throw new Error(
        `Versão de migration duplicada: ${version} (${seen.get(version)} e ${file.name}). ` +
          "Renomeie ou remova uma das migrations antes de continuar.",
      );
    }
    seen.set(version, file.name);
    const sql = fs.readFileSync(path.join(migrationsDir, file.name), "utf8");
    let appliedIf;
    try {
      appliedIf = readAppliedIf(sql);
    } catch (error) {
      throw migrationError(version, file.name, error);
    }
    migrations.push({
      version,
      name,
      filename: file.name,
      sql,
      appliedIf,
    });
  }

  return migrations.sort((a, b) => a.version.localeCompare(b.version));
}

function migrationError(version, filename, error) {
  return new Error(`migration ${version} (${filename}): ${error.message}`, {
    cause: error,
  });
}

function hasTable(db, table) {
  return Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table),
  );
}

function listUserTables(db) {
  return db
    .prepare(
      "SELECT name FROM sqlite_master " +
        "WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'schema_migrations'",
    )
    .all()
    .map((row) => row.name);
}

function hasRow(db, sql) {
  return Boolean(db.prepare(sql).get());
}

function appliedIfHolds(db, migration) {
  try {
    return hasRow(db, migration.appliedIf);
  } catch (error) {
    throw migrationError(migration.version, migration.filename, error);
  }
}

function readRecordedVersions(db) {
  if (!hasTable(db, "schema_migrations")) return [];
  return db
    .prepare("SELECT version FROM schema_migrations ORDER BY version")
    .all()
    .map((row) => row.version);
}

function backupTimestamp(now = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function backupPathFor(databasePath, now = new Date()) {
  const base = `${databasePath}.bak-${backupTimestamp(now)}`;
  if (!fs.existsSync(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!fs.existsSync(candidate)) return candidate;
  }
}

function createBackup(db, databasePath) {
  const checkpoint = db.pragma("wal_checkpoint(TRUNCATE)");
  const result = Array.isArray(checkpoint) ? checkpoint[0] : checkpoint;
  if (!result || result.busy !== 0) {
    throw new Error(BACKUP_BUSY_ERROR);
  }

  let backupPath = backupPathFor(databasePath);
  for (;;) {
    try {
      // COPYFILE_EXCL evita sobrescrever um backup existente.
      fs.copyFileSync(databasePath, backupPath, fs.constants.COPYFILE_EXCL);
      return backupPath;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      backupPath = backupPathFor(databasePath);
    }
  }
}

function migrateDatabase(
  db,
  { databasePath, migrationsDir, schemaFile, onBackup = undefined },
) {
  if (!databasePath)
    throw new Error("O caminho do banco SQLite não foi informado.");
  db.pragma("busy_timeout = 5000");

  const migrations = listMigrations(migrationsDir);
  const migrationsByVersion = new Map(
    migrations.map((migration) => [migration.version, migration]),
  );

  // Lido antes de aplicar init.sql: em caso de downgrade nada deve ser alterado.
  const recordedVersions = readRecordedVersions(db);
  const unknownVersions = recordedVersions.filter(
    (version) => !migrationsByVersion.has(version),
  );
  if (unknownVersions.length > 0) {
    throw new Error(
      `O banco foi criado por uma versão mais nova do CRM e possui migrations ` +
        `desconhecidas (${unknownVersions.join(", ")}). Atualize o CRM ou abra outro banco; ` +
        "este banco não foi alterado.",
    );
  }

  const isNew = listUserTables(db).length === 0;
  if (!isNew && !hasTable(db, "clients")) {
    throw new Error(NOT_CRM_ERROR);
  }

  const appliedSet = new Set(recordedVersions);
  const pending = migrations.filter(
    (migration) => !appliedSet.has(migration.version),
  );

  if (isNew) {
    // O init.sql já representa o schema mais recente: as migrations históricas
    // apenas entram no registro, sem reexecutar DDL.
    db.transaction(() => {
      db.exec(SCHEMA_MIGRATIONS_SQL);
      db.exec(fs.readFileSync(schemaFile, "utf8"));
      for (const migration of migrations) {
        if (migration.appliedIf && !appliedIfHolds(db, migration)) {
          throw new Error(
            `database/init.sql está desatualizado em relação à migration ${migration.version} ` +
              `(${migration.filename}).`,
          );
        }
      }
      const insert = db.prepare(
        "INSERT INTO schema_migrations (version, name) VALUES (?, ?)",
      );
      for (const migration of migrations) {
        insert.run(migration.version, migration.name);
      }
    }).immediate();
    return {
      isNew: true,
      applied: [],
      adopted: migrations.map((migration) => migration.version),
      backupPath: null,
    };
  }

  let backupPath = null;
  if (pending.length > 0 && databasePath !== ":memory:") {
    // Fora de transação: o checkpoint e a cópia refletem o arquivo atual.
    backupPath = createBackup(db, databasePath);
    if (onBackup) onBackup(backupPath);
  }

  if (pending.length > 0) {
    // O registro precisa existir antes de qualquer leitura/gravação de versões,
    // mas só é criado depois que o backup estiver garantido.
    db.exec(SCHEMA_MIGRATIONS_SQL);
  }

  const insert = db.prepare(
    "INSERT INTO schema_migrations (version, name) VALUES (?, ?)",
  );
  const applied = [];
  const adopted = [];

  for (const migration of pending) {
    const outcome = db
      .transaction(() => {
        if (migration.appliedIf && appliedIfHolds(db, migration)) {
          insert.run(migration.version, migration.name);
          return "adopted";
        }
        try {
          db.exec(migration.sql);
        } catch (error) {
          throw migrationError(migration.version, migration.filename, error);
        }
        insert.run(migration.version, migration.name);
        return "applied";
      })
      .immediate();

    // O resumo só reflete o que foi efetivamente confirmado no commit.
    if (outcome === "applied") applied.push(migration.version);
    else adopted.push(migration.version);
  }

  // Migrations primeiro, schema atual depois: init.sql pode declarar índices ou
  // constraints sobre colunas que as migrations acabaram de criar.
  db.transaction(() => {
    db.exec(fs.readFileSync(schemaFile, "utf8"));
  }).immediate();

  return { isNew: false, applied, adopted, backupPath };
}

function runMigrationsFile({
  databasePath,
  migrationsDir,
  schemaFile,
  onBackup,
} = {}) {
  if (!databasePath)
    throw new Error("O caminho do banco SQLite não foi informado.");
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    // Não crie tabelas do CRM dentro de um banco alheio.
    if (fs.existsSync(databasePath) && fs.statSync(databasePath).size > 0) {
      validateDatabase(databasePath);
    }
  }
  const db = new Database(databasePath);
  try {
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    return migrateDatabase(db, {
      databasePath,
      migrationsDir,
      schemaFile,
      onBackup,
    });
  } finally {
    db.close();
  }
}

function printSummary(databasePath, summary) {
  console.log(`Banco: ${databasePath}`);
  if (summary.isNew) {
    console.log(
      `Banco novo: schema de init.sql aplicado; ${summary.adopted.length} ` +
        "migration(s) registrada(s) como baseline.",
    );
    return;
  }
  if (summary.applied.length === 0 && summary.adopted.length === 0) {
    console.log("Nenhuma migration pendente.");
    return;
  }
  if (summary.applied.length > 0) {
    console.log(`Migrations aplicadas: ${summary.applied.join(", ")}`);
  }
  if (summary.adopted.length > 0) {
    console.log(
      `Migrations adotadas (já refletidas no banco): ${summary.adopted.join(", ")}`,
    );
  }
}

if (require.main === module) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Sem .env.local, usa SQLITE_PATH ou o caminho padrão.
  }
  const { defaultDatabasePath } = require("./sqlite-paths.cjs");
  const databasePath = process.argv[2] || defaultDatabasePath();
  try {
    const summary = runMigrationsFile({
      databasePath,
      migrationsDir: path.join(__dirname, "migrations"),
      schemaFile: path.join(__dirname, "init.sql"),
      // stderr imediato: o Electron repassa essa linha no diálogo de erro.
      onBackup: (backupPath) =>
        console.error(`Backup do banco anterior: ${backupPath}`),
    });
    printSummary(databasePath, summary);
  } catch (error) {
    console.error(
      `Falha ao atualizar o banco (${databasePath}): ${error.message}`,
    );
    process.exitCode = 1;
  }
}

module.exports = {
  MIGRATION_PATTERN,
  listMigrations,
  readAppliedIf,
  backupPathFor,
  migrateDatabase,
  runMigrationsFile,
};
