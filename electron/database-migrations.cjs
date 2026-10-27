const path = require("node:path");

// Executa a CLI de migrations em um processo Node próprio (Electron com
// ELECTRON_RUN_AS_NODE), sem carregar better-sqlite3 no processo principal.
function applyMigrations({
  databasePath,
  spawner = require("node:child_process").spawn,
  execPath = process.execPath,
  migrateScript = path.resolve(__dirname, "../database/migrate.cjs"),
  cwd = path.resolve(__dirname, ".."),
  env = process.env,
  timeoutMs = 120000,
  killEscalationMs = 5000,
}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };

    let child;
    try {
      child = spawner(execPath, [migrateScript, databasePath], {
        cwd,
        env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      finish(
        new Error(
          `Não foi possível executar a atualização do banco: ${error.message}`,
        ),
      );
      return;
    }

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    timer = setTimeout(() => {
      child.kill?.("SIGTERM");
      // Sem escalonamento, uma migration travada continuaria escrevendo no banco
      // depois que a janela abortou.
      setTimeout(() => child.kill?.("SIGKILL"), killEscalationMs);
      finish(
        new Error(
          `Tempo limite de ${timeoutMs} ms excedido ao atualizar o banco. ${stderr.trim()}`.trim(),
        ),
      );
    }, timeoutMs);

    const failure = (code) =>
      new Error(
        `Falha ao atualizar o banco (código ${code ?? "desconhecido"}): ` +
          (stderr.trim() || "sem detalhes."),
      );

    // "close" ocorre depois do fechamento dos streams; "exit" cobre
    // implementações que sinalizam apenas a saída do processo.
    child.once("close", (code) => {
      if (code === 0) finish(null, stdout);
      else finish(failure(code));
    });
    child.once("exit", (code) => {
      setImmediate(() => {
        if (code === 0) finish(null, stdout);
        else finish(failure(code));
      });
    });
    child.once("error", (error) => {
      finish(
        new Error(
          `Não foi possível executar a atualização do banco: ${error.message}`,
        ),
      );
    });
  });
}

module.exports = { applyMigrations };
