// Executado pelo Electron (main process) a partir de `scripts/layout-check.cjs`.
// Recebe a configuração em LAYOUT_CHECK_CONFIG e, para cada rota e largura,
// mede overflow de página e conteúdo cortado dentro das listagens.
//
// O `require("electron")` fica dentro de `start()` para que os helpers puros
// possam ser importados por testes fora do Electron, sem efeitos colaterais.
const CONFIG_ENV = "LAYOUT_CHECK_CONFIG";
const NAVIGATION_TIMEOUT_MS = 60000;
// Espera a página parar de mudar (hidratação, fetch inicial, fontes) antes de
// medir; o Next em dev pode compilar a rota de API durante o primeiro acesso.
const STABLE_TIMEOUT_MS = 4000;
const STABLE_INTERVAL_MS = 150;
// Tempo para o navegador relayoutar após redimensionar a janela.
const RELAYOUT_MS = 60;
const TOLERANCE_PX = 1;

// Executada no renderer via `executeJavaScript`; não pode referenciar nada fora
// do próprio corpo.
function measurePage() {
  const root = document.documentElement;
  const viewportWidth = root.clientWidth;
  const clippingOverflow = new Set(["hidden", "auto", "scroll", "clip"]);

  function describe(element) {
    let selector = element.tagName.toLowerCase();
    if (element.id) selector += `#${element.id}`;
    for (const className of element.classList) selector += `.${className}`;
    return selector;
  }

  // Um elemento fora da viewport só é problema se nenhum ancestral com
  // overflow de recorte o contiver dentro dela.
  function isContainedByAncestor(element) {
    for (
      let node = element.parentElement;
      node && node !== root;
      node = node.parentElement
    ) {
      if (!clippingOverflow.has(getComputedStyle(node).overflowX)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.right <= viewportWidth + 1 && rect.left >= -1) return true;
    }
    return false;
  }

  const overflowing = [];
  for (const element of document.body.querySelectorAll("*")) {
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.right <= viewportWidth + 1 && rect.left >= -1) continue;
    if (isContainedByAncestor(element)) continue;
    overflowing.push({
      selector: describe(element),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
    });
    if (overflowing.length >= 3) break;
  }

  // `.contact-list` tem `overflow: hidden`: ações que passam da borda direita
  // são cortadas sem gerar overflow de página.
  const clipped = [];
  for (const list of document.querySelectorAll(".contact-list")) {
    const edge = list.getBoundingClientRect().right;
    const children = list.querySelectorAll(
      ".contact-row-actions, .task-status",
    );
    for (const child of children) {
      const rect = child.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const excess = rect.right - edge;
      if (excess <= 1) continue;
      clipped.push({
        selector: describe(child),
        container: describe(list),
        excess: Math.round(excess),
        right: Math.round(rect.right),
        edge: Math.round(edge),
      });
    }
  }

  return {
    clientWidth: root.clientWidth,
    // `clientWidth` desconta a barra de rolagem; a largura pedida à janela
    // corresponde ao `innerWidth`, usado para detectar viewport limitada.
    innerWidth: window.innerWidth,
    scrollWidth: root.scrollWidth,
    overflowing,
    clipped,
    // Sem dados, `.contact-list` não é renderizado e a checagem de conteúdo
    // cortado passaria sem medir nada.
    targetCounts: {
      ".contact-row-actions": document.querySelectorAll(".contact-row-actions")
        .length,
      ".task-status": document.querySelectorAll(".task-status").length,
    },
  };
}

function readConfig(env = process.env) {
  const raw = env[CONFIG_ENV];
  if (!raw) {
    throw new Error(
      `Configuração ausente (${CONFIG_ENV}); execute com \`npm run layout:check\`.`,
    );
  }
  const config = JSON.parse(raw);
  const valid =
    config &&
    typeof config.baseUrl === "string" &&
    Array.isArray(config.routes) &&
    config.routes.length > 0 &&
    Array.isArray(config.widths) &&
    config.widths.length > 0 &&
    Number.isFinite(config.height);
  if (!valid) throw new Error(`Configuração inválida em ${CONFIG_ENV}.`);
  return config;
}

function joinUrl(baseUrl, route) {
  return `${baseUrl.replace(/\/+$/, "")}${route}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`tempo esgotado após ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout])
    .catch((error) => {
      throw new Error(`${error.message} (${label})`);
    })
    .finally(() => clearTimeout(timer));
}

function createWindow(width, height, BrowserWindow) {
  const win = new BrowserWindow({
    show: false,
    width,
    height,
    useContentSize: true,
    webPreferences: {
      // Janela oculta não pode ter rAF/timers estrangulados, senão a medição
      // acontece antes do relayout.
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  return win;
}

async function settle(webContents, { delayImpl = delay } = {}) {
  // Em janela headless escondida o requestAnimationFrame pode ficar pausado
  // para sempre; um timer no renderer resolve com backgroundThrottling off.
  await webContents.executeJavaScript(
    "new Promise((resolve) => setTimeout(resolve, 0))",
    true,
  );
  await delayImpl(RELAYOUT_MS);
}

async function loadRoute(
  win,
  url,
  { waitForStableLayoutImpl = waitForStableLayout } = {},
) {
  await withTimeout(win.loadURL(url), NAVIGATION_TIMEOUT_MS, url);
  await win.webContents.executeJavaScript(
    "document.fonts.ready.then(() => true)",
    true,
  );
  await waitForStableLayoutImpl(win.webContents);
}

async function waitForStableLayout(
  webContents,
  {
    now = Date.now,
    delayImpl = delay,
    timeoutMs = STABLE_TIMEOUT_MS,
    intervalMs = STABLE_INTERVAL_MS,
  } = {},
) {
  const snapshotScript =
    "JSON.stringify([document.documentElement.scrollWidth, document.documentElement.scrollHeight, document.querySelectorAll('.contact-list').length])";
  let previous = null;
  let stable = 0;
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    const snapshot = await webContents.executeJavaScript(snapshotScript, true);
    if (snapshot === previous) {
      stable += 1;
      if (stable >= 2) return;
    } else {
      stable = 0;
      previous = snapshot;
    }
    await delayImpl(intervalMs);
  }
}

// No Linux o redimensionamento da janela é assíncrono: sem esperar a viewport
// chegar na largura pedida a medição lê o tamanho da iteração anterior.
async function applyViewport(
  win,
  width,
  height,
  { attempts = 20, intervalMs = 25, delayImpl = delay } = {},
) {
  win.setContentSize(width, height);
  let current = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    current = await win.webContents.executeJavaScript(
      "window.innerWidth",
      true,
    );
    if (Math.abs(current - width) <= TOLERANCE_PX) return current;
    await delayImpl(intervalMs);
  }
  return current;
}

function describeOverflowing(overflowing) {
  if (overflowing.length === 0) return "";
  const items = overflowing.map(
    (item) => `${item.selector} (left ${item.left}px, right ${item.right}px)`,
  );
  return `; elementos além da viewport: ${items.join(", ")}`;
}

// Decide, a partir das medições do renderer, quais mensagens são problemas e se
// a viewport medida divergiu da largura pedida. Tolerância de 1px evita ruído de
// arredondamento sem esconder overflow real.
function analyzeMeasurement({
  route,
  width,
  result,
  tolerance = TOLERANCE_PX,
}) {
  const measuredWidth = result.innerWidth ?? result.clientWidth;
  const viewportMismatch =
    Math.abs(measuredWidth - width) > tolerance
      ? `${route} @ ${width}px → ${measuredWidth}px`
      : null;

  const problems = [];
  const pageOverflow = result.scrollWidth - result.clientWidth;
  if (pageOverflow > tolerance) {
    problems.push(
      `${route} @ ${width}px: overflow de página (scrollWidth ${result.scrollWidth}, clientWidth ${result.clientWidth}, excedente ${pageOverflow}px)${describeOverflowing(result.overflowing)}`,
    );
  }

  for (const item of result.clipped) {
    problems.push(
      `${route} @ ${width}px: ${item.selector} excede ${item.container} em ${item.excess}px (right ${item.right}px > borda ${item.edge}px)`,
    );
  }

  return { problems, viewportMismatch };
}

async function run({
  env = process.env,
  logger = console,
  BrowserWindow,
  loadRouteImpl = loadRoute,
  settleImpl = settle,
} = {}) {
  const config = readConfig(env);
  const problems = [];
  const viewportMismatches = [];
  let checks = 0;

  const win = createWindow(config.widths[0], config.height, BrowserWindow);
  try {
    for (const route of config.routes) {
      const url = joinUrl(config.baseUrl, route);
      try {
        await loadRouteImpl(win, url);
      } catch (error) {
        const message = `${route} @ todas: falha ao carregar ${url}: ${error.message}`;
        problems.push(message);
        logger.error(message);
        continue;
      }

      let lastResult = null;
      for (const width of config.widths) {
        await applyViewport(win, width, config.height);
        await settleImpl(win.webContents);
        const result = await win.webContents.executeJavaScript(
          `(${measurePage.toString()})()`,
          true,
        );
        lastResult = result;

        if (!result.clientWidth) {
          throw new Error(
            `viewport com largura 0 em ${route} @ ${width}px; a janela não renderizou.`,
          );
        }

        checks += 1;
        const analyzed = analyzeMeasurement({ route, width, result });
        if (analyzed.viewportMismatch) {
          viewportMismatches.push(analyzed.viewportMismatch);
        }
        for (const message of analyzed.problems) {
          problems.push(message);
          logger.log(message);
        }
      }

      // Sem linhas na listagem a checagem de conteúdo cortado não mede nada;
      // avisa em vez de passar silenciosamente.
      const expectedTarget = config.targets && config.targets[route];
      if (expectedTarget && lastResult.targetCounts[expectedTarget] === 0) {
        logger.error(
          `Aviso: ${route} não renderizou nenhum "${expectedTarget}" (lista vazia?); rode \`npm run db:seed\` para medir com dados.`,
        );
      }
    }
  } finally {
    win.destroy();
  }

  // Larguras muito grandes podem ser limitadas pela tela virtual do modo
  // headless; o aviso evita ler o rótulo da largura como viewport real.
  if (viewportMismatches.length > 0) {
    logger.error(
      `Aviso: ${viewportMismatches.length} medições usaram viewport diferente da largura pedida (${viewportMismatches
        .slice(0, 3)
        .join("; ")}${viewportMismatches.length > 3 ? "; ..." : ""}).`,
    );
  }

  logger.log(`${checks} verificações, ${problems.length} problemas`);
  return problems.length > 0 ? 1 : 0;
}

// Garante que problemas e resumo cheguem ao runner mesmo com stdout em pipe
// antes de encerrar o processo.
function exitAfterFlush(app, code) {
  const fallback = setTimeout(() => app.exit(code), 2000);
  fallback.unref();
  process.stdout.write("", () => {
    clearTimeout(fallback);
    app.exit(code);
  });
}

function start({ electron = require("electron") } = {}) {
  const { app, BrowserWindow } = electron;

  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("ozone-platform", "headless");
  app.commandLine.appendSwitch("disable-gpu");

  app
    .whenReady()
    .then(async () => {
      let code = 1;
      try {
        code = await run({ BrowserWindow });
      } catch (error) {
        console.error(error.message);
      }
      exitAfterFlush(app, code);
    })
    .catch((error) => {
      console.error(error.message);
      exitAfterFlush(app, 1);
    });
}

// Electron não define `require.main === module` para o script principal;
// nesse caso identificamos o processo pelo `process.versions.electron`.
const isElectronEntry =
  Boolean(process.versions.electron) &&
  Boolean(process.env[CONFIG_ENV]) &&
  !process.env.VITEST;

if (require.main === module || isElectronEntry) {
  start();
}

module.exports = {
  CONFIG_ENV,
  TOLERANCE_PX,
  analyzeMeasurement,
  applyViewport,
  createWindow,
  describeOverflowing,
  exitAfterFlush,
  joinUrl,
  loadRoute,
  measurePage,
  readConfig,
  run,
  settle,
  start,
  waitForStableLayout,
  withTimeout,
};
