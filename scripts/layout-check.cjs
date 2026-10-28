const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// Verificação manual de responsividade: abre cada rota no Chromium do Electron
// em modo headless, redimensiona a janela e mede overflow de página e conteúdo
// cortado. Exige um servidor da aplicação (por padrão `npm run dev`) e não faz
// parte de `npm test`.
const ROUTES = [
  "/",
  "/clientes",
  "/contatos",
  "/oportunidades",
  "/tarefas",
  "/configuracoes",
  "/clientes/novo",
  "/contatos/novo",
  "/oportunidades/nova",
  "/tarefas/nova",
];

// Inclui as larguras vizinhas dos breakpoints (600/601, 680/681, 900/901) para
// pegar regressões exatamente na transição entre os layouts.
const WIDTHS = [
  320, 360, 375, 414, 480, 600, 601, 640, 680, 681, 700, 768, 820, 900, 901,
  960, 1024, 1100, 1200, 1280, 1440,
];

const HEIGHT = 900;
// Seletor que cada rota precisa renderizar para a checagem de conteúdo cortado
// ter efeito; sem linhas na listagem a medição passaria vazia.
const TARGETS = {
  "/contatos": ".contact-row-actions",
  "/tarefas": ".task-status",
};
const DEFAULT_BASE_URL = "http://localhost:3000";
const PREFLIGHT_TIMEOUT_MS = 5000;
const MAIN_SCRIPT = path.join(__dirname, "layout-check-main.cjs");

function parseBaseUrl(value = DEFAULT_BASE_URL) {
  const baseUrl = value.trim().replace(/\/+$/, "");
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(
      `LAYOUT_BASE_URL inválida: "${value}". Informe uma URL como http://localhost:3000.`,
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `LAYOUT_BASE_URL inválida: "${value}". Use http:// ou https://.`,
    );
  }
  return baseUrl;
}

function resolveElectronBinary({ root }) {
  // `require("electron")` fora do Electron também devolve o binário, mas o
  // caminho direto deixa claro o requisito de `npm install`.
  const name = process.platform === "win32" ? "electron.exe" : "electron";
  const binary = path.join(root, "node_modules", "electron", "dist", name);
  return fs.existsSync(binary) ? binary : null;
}

async function canReachServer(baseUrl, { fetchImpl = fetch } = {}) {
  try {
    const response = await fetchImpl(`${baseUrl}/`, {
      signal: AbortSignal.timeout(PREFLIGHT_TIMEOUT_MS),
    });
    // 5xx indica servidor quebrado; 404 em `/` ainda é alcançável e a rota
    // específica falhará na navegação com uma mensagem própria.
    return { ok: response.status < 500, status: response.status };
  } catch (error) {
    return { ok: false, error };
  }
}

function formatUnreachableServer({ baseUrl, result }) {
  const detail = result.error
    ? result.error.message
    : `status HTTP ${result.status}`;
  return [
    `Servidor não respondeu em ${baseUrl} (${detail}).`,
    "Inicie `npm run dev` em outro terminal ou aponte LAYOUT_BASE_URL para uma instância ativa.",
  ].join("\n");
}

function spawnElectron({ binary, config, env, spawnImpl = spawn }) {
  return new Promise((resolve) => {
    // A configuração vai por variável de ambiente para não disputar com os
    // switches do Chromium; o main process a lê de LAYOUT_CHECK_CONFIG.
    const child = spawnImpl(
      binary,
      [
        // Switches do Chromium precisam vir antes do script; depois dele o
        // Electron os trata como argumentos do app e o sandbox pode falhar.
        // `ozone-platform`/`disable-gpu` são aplicados pelo próprio script:
        // passá-los também aqui faz o processo abortar com core dump.
        "--no-sandbox",
        MAIN_SCRIPT,
      ],
      {
        // `VITEST` desativaria a entrada do script sob Electron por engano.
        env: {
          ...env,
          VITEST: undefined,
          LAYOUT_CHECK_CONFIG: JSON.stringify(config),
        },
        stdio: "inherit",
      },
    );
    child.on("error", (error) => resolve({ code: 1, error }));
    child.on("exit", (code) => resolve({ code: code ?? 1 }));
  });
}

async function runLayoutCheck({
  env = process.env,
  logger = console,
  fetchImpl = fetch,
  spawnImpl = spawn,
  root = path.resolve(__dirname, ".."),
} = {}) {
  let baseUrl;
  try {
    baseUrl = parseBaseUrl(env.LAYOUT_BASE_URL || DEFAULT_BASE_URL);
  } catch (error) {
    logger.error(error.message);
    return 1;
  }

  const binary = resolveElectronBinary({ root });
  if (!binary) {
    logger.error(
      "Electron não encontrado em `node_modules/electron/dist`. Rode `npm install` antes de `npm run layout:check`.",
    );
    return 1;
  }

  const reachable = await canReachServer(baseUrl, { fetchImpl });
  if (!reachable.ok) {
    logger.error(formatUnreachableServer({ baseUrl, result: reachable }));
    return 1;
  }

  const config = {
    baseUrl,
    routes: ROUTES,
    widths: WIDTHS,
    height: HEIGHT,
    targets: TARGETS,
  };
  logger.log(
    `Verificando ${baseUrl}: ${ROUTES.length} rotas × ${WIDTHS.length} larguras (altura ${HEIGHT}px).`,
  );

  const result = await spawnElectron({ binary, config, env, spawnImpl });
  if (result.error) {
    logger.error(`Falha ao executar o Electron: ${result.error.message}`);
    return 1;
  }
  if (result.code !== 0) {
    logger.error(
      `Verificação de responsividade encontrou problemas (exit ${result.code}).`,
    );
    return 1;
  }
  return 0;
}

if (require.main === module) {
  runLayoutCheck().then((code) => process.exit(code));
}

module.exports = {
  HEIGHT,
  ROUTES,
  WIDTHS,
  canReachServer,
  formatUnreachableServer,
  parseBaseUrl,
  resolveElectronBinary,
  runLayoutCheck,
  spawnElectron,
};
