const fs = require("node:fs");
const path = require("node:path");

// Prepara o diretório `.next/standalone` (gerado por `next build` com
// output: "standalone") copiando os recursos que o Next não rastreia
// automaticamente via fs: `.next/static`, `public`, a pasta `database`
// (init.sql, migrations e os .cjs de migrations) e o `better-sqlite3`, cujo
// binding N-API é carregado dinamicamente.
function prepareStandalone({ root }) {
  const standalone = path.join(root, ".next", "standalone");

  if (!fs.existsSync(path.join(standalone, "server.js"))) {
    throw new Error(
      "Standalone ausente: rode `npm run build` (output: standalone) antes de `npm run prepare:standalone`.",
    );
  }

  // Copia a pasta `database` inteira (init.sql, migrations e os .cjs usados pelo
  // processo de migrations). O banco do usuário e seus arquivos WAL/backups não são
  // recursos somente leitura e ficam de fora do standalone.
  function copyDatabase() {
    const from = path.join(root, "database");
    const to = path.join(standalone, "database");
    fs.rmSync(to, { recursive: true, force: true });
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      if (!entry.isDirectory() && /\.sqlite([.-]|$)/.test(entry.name)) continue;
      fs.cpSync(path.join(from, entry.name), path.join(to, entry.name), {
        recursive: true,
      });
    }
  }

  // Recursos copiados de forma idempotente (rm + cpSync recursivo) para o
  // standalone, que o Next não rastreia automaticamente via fs.
  const steps = [
    {
      from: path.join(root, ".next", "static"),
      to: path.join(standalone, ".next", "static"),
    },
    { from: path.join(root, "public"), to: path.join(standalone, "public") },
    // O tracing do Next pode não copiar o binding carregado dinamicamente;
    // sobrescreve com o pacote atual para garantir o prebuild da plataforma.
    {
      from: path.join(root, "node_modules", "better-sqlite3"),
      to: path.join(standalone, "node_modules", "better-sqlite3"),
    },
  ];

  for (const { from, to } of steps) {
    fs.rmSync(to, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.cpSync(from, to, { recursive: true });
  }

  copyDatabase();

  console.log("Standalone preparado:", standalone);
  console.warn(
    "Aviso: a cópia de `node_modules/better-sqlite3` garante o prebuild N-API da plataforma alvo, que o tracing do Next pode não incluir. Gere o pacote na mesma plataforma/arquitetura do destino.",
  );
  return standalone;
}

if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  try {
    prepareStandalone({ root });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { prepareStandalone };
