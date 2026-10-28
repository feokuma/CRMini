const { spawnSync } = require("node:child_process");

// Verifica se o better-sqlite3 carrega no binário do Electron. O módulo usa
// prebuilds N-API (`prebuilds/<plataforma>-<arch>.node`), então o mesmo binário
// serve ao Node e ao Electron; a checagem detecta prebuild ausente/incompatível
// antes de abrir a janela e falhar no processo do servidor.
function checkElectronAbi({
  // `require("electron")` fora do Electron devolve o caminho do binário.
  electronBinary = require("electron"),
  spawner = spawnSync,
  env = process.env,
  logger = console,
} = {}) {
  const result = spawner(electronBinary, ["-e", "require('better-sqlite3')"], {
    env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
    encoding: "utf8",
  });

  if (result.error) {
    logger.error(
      `Não foi possível executar o Electron para validar o better-sqlite3: ${result.error.message}`,
    );
    return 1;
  }

  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || "").trim();
    logger.error(
      "better-sqlite3 não carrega no Electron (prebuild N-API ausente ou incompatível).",
    );
    if (details) logger.error(details);
    logger.error(
      [
        "",
        "Verifique se existe o prebuild da plataforma/arquitetura em",
        "`node_modules/better-sqlite3/prebuilds`. Reinstale com `npm ci` ou compile o",
        "módulo para esta plataforma antes de abrir a versão desktop.",
      ].join("\n"),
    );
    return 1;
  }

  return 0;
}

if (require.main === module) process.exit(checkElectronAbi());

module.exports = { checkElectronAbi };
