import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const main = require("../../scripts/layout-check-main.cjs") as {
  CONFIG_ENV: string;
  TOLERANCE_PX: number;
  analyzeMeasurement: (options: {
    route: string;
    width: number;
    result: Measurement;
    tolerance?: number;
  }) => { problems: string[]; viewportMismatch: string | null };
  applyViewport: (
    win: {
      setContentSize: (width: number, height: number) => void;
      webContents: {
        executeJavaScript: (...args: unknown[]) => Promise<unknown>;
      };
    },
    width: number,
    height: number,
    options?: {
      attempts?: number;
      intervalMs?: number;
      delayImpl?: (ms: number) => Promise<void>;
    },
  ) => Promise<number>;
  createWindow: (
    width: number,
    height: number,
    BrowserWindow: unknown,
  ) => Window;
  describeOverflowing: (
    overflowing: Array<{ selector: string; left: number; right: number }>,
  ) => string;
  exitAfterFlush: (app: { exit: (code: number) => void }, code: number) => void;
  joinUrl: (baseUrl: string, route: string) => string;
  loadRoute: (
    win: Win,
    url: string,
    options?: { waitForStableLayoutImpl?: () => Promise<void> },
  ) => Promise<void>;
  measurePage: () => Measurement;
  readConfig: (env?: Record<string, string | undefined>) => Config;
  run: (options?: Record<string, unknown>) => Promise<number>;
  settle: (
    webContents: {
      executeJavaScript: (...args: unknown[]) => Promise<unknown>;
    },
    options?: { delayImpl?: (ms: number) => Promise<void> },
  ) => Promise<void>;
  start: (options?: { electron?: Record<string, unknown> }) => void;
  waitForStableLayout: (
    webContents: {
      executeJavaScript: (...args: unknown[]) => Promise<unknown>;
    },
    options?: Record<string, unknown>,
  ) => Promise<void>;
  withTimeout: <T>(
    promise: Promise<T>,
    ms: number,
    label: string,
  ) => Promise<T>;
};

type Measurement = {
  clientWidth: number;
  scrollWidth: number;
  overflowing: Array<{ selector: string; left: number; right: number }>;
  clipped: Array<{
    selector: string;
    container: string;
    excess: number;
    right: number;
    edge: number;
  }>;
  targetCounts: Record<string, number>;
};

type Config = {
  baseUrl: string;
  routes: string[];
  widths: number[];
  height: number;
  targets?: Record<string, string>;
};

type Win = {
  loadURL: (url: string) => Promise<void>;
  webContents: { executeJavaScript: (...args: unknown[]) => Promise<unknown> };
  setContentSize?: (width: number, height: number) => void;
  setMenuBarVisibility?: (visible: boolean) => void;
  destroy?: () => void;
};

type Styles = {
  display?: string;
  visibility?: string;
  overflowX?: string;
};

const styles = new Map<Element, Styles>();

beforeEach(() => {
  styles.clear();
  vi.spyOn(globalThis, "getComputedStyle").mockImplementation(((
    element: Element,
  ) => {
    const overrides = styles.get(element) ?? {};
    return {
      display: overrides.display ?? "block",
      visibility: overrides.visibility ?? "visible",
      overflowX: overrides.overflowX ?? "visible",
    };
  }) as unknown as typeof getComputedStyle);
});

afterEach(() => {
  styles.clear();
  document.body.innerHTML = "";
  delete (document.documentElement as unknown as Record<string, unknown>)
    .clientWidth;
  delete (document.documentElement as unknown as Record<string, unknown>)
    .scrollWidth;
  delete process.env[main.CONFIG_ENV];
});

function setViewport(clientWidth: number, scrollWidth = clientWidth) {
  Object.defineProperty(document.documentElement, "clientWidth", {
    configurable: true,
    value: clientWidth,
  });
  Object.defineProperty(document.documentElement, "scrollWidth", {
    configurable: true,
    value: scrollWidth,
  });
}

function setRect(
  element: Element,
  rect: { left: number; right: number; width?: number; height?: number },
) {
  const full = {
    left: rect.left,
    right: rect.right,
    width: rect.width ?? rect.right - rect.left,
    height: rect.height ?? 20,
    top: 0,
    bottom: rect.height ?? 20,
  };
  element.getBoundingClientRect = (() => full) as () => DOMRect;
  return element;
}

function style(element: Element, overrides: Styles) {
  styles.set(element, overrides);
  return element;
}

function query<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`fixture ausente: ${selector}`);
  return element;
}

function measurement(overrides: Partial<Measurement> = {}): Measurement {
  return {
    clientWidth: 600,
    scrollWidth: 600,
    overflowing: [],
    clipped: [],
    targetCounts: {},
    ...overrides,
  };
}

function fakeWindow(results: Measurement[]) {
  let currentWidth = 600;
  const executeJavaScript = vi.fn(async (script: string) => {
    // `applyViewport` consulta a largura aplicada antes de medir.
    if (script === "window.innerWidth") return currentWidth;
    return results.shift();
  });
  return {
    loadURL: vi.fn(async () => {}),
    setContentSize: vi.fn((width: number) => {
      currentWidth = width;
    }),
    setMenuBarVisibility: vi.fn(),
    destroy: vi.fn(),
    webContents: { executeJavaScript },
  };
}

function browserWindow(win: unknown) {
  return class {
    constructor() {
      return win;
    }
  };
}

function configEnv(config: Config) {
  return { [main.CONFIG_ENV]: JSON.stringify(config) };
}

function baseConfig(overrides: Partial<Config> = {}): Config {
  return {
    baseUrl: "http://localhost:3000",
    routes: ["/clientes"],
    widths: [600, 601],
    height: 900,
    targets: {},
    ...overrides,
  };
}

function logger() {
  return { log: vi.fn(), error: vi.fn() };
}

describe("readConfig", () => {
  // Sem configuração não há como saber o que medir; a falha precisa ser explícita.
  it("explica quando LAYOUT_CHECK_CONFIG não foi informado", () => {
    expect(() => main.readConfig({})).toThrow(/Configuração ausente/);
  });

  it("rejeita JSON malformado", () => {
    expect(() => main.readConfig({ [main.CONFIG_ENV]: "{nao-json" })).toThrow();
  });

  it("rejeita rotas ou larguras vazias e altura não numérica", () => {
    const base = baseConfig();
    const invalid = [
      { ...base, routes: [] },
      { ...base, widths: [] },
      { ...base, height: "900" },
      { ...base, baseUrl: 3000 },
    ];

    for (const config of invalid) {
      expect(() =>
        main.readConfig({ [main.CONFIG_ENV]: JSON.stringify(config) }),
      ).toThrow(/Configuração inválida/);
    }
  });

  it("devolve a configuração válida", () => {
    const config = baseConfig();

    expect(
      main.readConfig({ [main.CONFIG_ENV]: JSON.stringify(config) }),
    ).toEqual(config);
  });
});

describe("joinUrl", () => {
  it("junta a base com a rota sem duplicar barra", () => {
    expect(main.joinUrl("http://localhost:3000", "/clientes")).toBe(
      "http://localhost:3000/clientes",
    );
    expect(main.joinUrl("http://localhost:3000///", "/")).toBe(
      "http://localhost:3000/",
    );
  });
});

describe("describeOverflowing", () => {
  it("não gera texto sem elementos", () => {
    expect(main.describeOverflowing([])).toBe("");
  });

  it("lista seletor e medidas de cada elemento", () => {
    expect(
      main.describeOverflowing([
        { selector: "div#wide", left: -5, right: 620 },
        { selector: "span.tag", left: 0, right: 640 },
      ]),
    ).toBe(
      "; elementos além da viewport: div#wide (left -5px, right 620px), span.tag (left 0px, right 640px)",
    );
  });
});

describe("analyzeMeasurement", () => {
  it("não reporta nada no limite exato da tolerância de 1px", () => {
    expect(
      main.analyzeMeasurement({
        route: "/clientes",
        width: 600,
        result: measurement({ scrollWidth: 601 }),
      }),
    ).toEqual({ problems: [], viewportMismatch: null });
  });

  it("reporta overflow de página acima de 1px com os elementos excedentes", () => {
    const { problems } = main.analyzeMeasurement({
      route: "/clientes",
      width: 600,
      result: measurement({
        clientWidth: 600,
        scrollWidth: 602,
        overflowing: [{ selector: "div#wide", left: 0, right: 602 }],
      }),
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(
      "/clientes @ 600px: overflow de página (scrollWidth 602, clientWidth 600, excedente 2px)",
    );
    expect(problems[0]).toContain("div#wide (left 0px, right 602px)");
  });

  it("reporta conteúdo cortado além da borda do container", () => {
    const { problems } = main.analyzeMeasurement({
      route: "/contatos",
      width: 601,
      result: measurement({
        clientWidth: 601,
        scrollWidth: 601,
        clipped: [
          {
            selector: "div.contact-row-actions",
            container: "div.contact-list",
            excess: 20,
            right: 621,
            edge: 601,
          },
        ],
      }),
    });

    expect(problems).toEqual([
      "/contatos @ 601px: div.contact-row-actions excede div.contact-list em 20px (right 621px > borda 601px)",
    ]);
  });

  it("sinaliza viewport divergente apenas acima de 1px", () => {
    expect(
      main.analyzeMeasurement({
        route: "/tarefas",
        width: 600,
        result: measurement({ clientWidth: 601 }),
      }).viewportMismatch,
    ).toBeNull();

    expect(
      main.analyzeMeasurement({
        route: "/tarefas",
        width: 600,
        result: measurement({ clientWidth: 603 }),
      }).viewportMismatch,
    ).toBe("/tarefas @ 600px → 603px");
  });
});

describe("measurePage", () => {
  // Conteúdo além da viewport sem ancestral que recorte é overflow de página real.
  it("detecta elemento além da viewport sem ancestral com overflow", () => {
    setViewport(500, 600);
    document.body.innerHTML = '<div id="wide" class="hero"></div>';
    setRect(query("#wide"), { left: 0, right: 600 });

    const result = main.measurePage();

    expect(result.clientWidth).toBe(500);
    expect(result.scrollWidth).toBe(600);
    expect(result.overflowing).toEqual([
      { selector: "div#wide.hero", left: 0, right: 600 },
    ]);
  });

  // `.contact-list` recorta o excesso: o elemento não vira overflow de página,
  // mas ainda precisa ser detectado como conteúdo cortado.
  it("ignora elemento além da viewport contido por ancestral com overflow", () => {
    setViewport(500, 500);
    document.body.innerHTML = '<div id="clip"><div id="wide"></div></div>';
    style(query("#clip"), { overflowX: "hidden" });
    setRect(query("#clip"), { left: 0, right: 500 });
    setRect(query("#wide"), { left: 0, right: 600 });

    expect(main.measurePage().overflowing).toEqual([]);
  });

  it("não considera contido quando o ancestral recortador também passa da viewport", () => {
    setViewport(500, 600);
    document.body.innerHTML = '<div id="clip"><div id="wide"></div></div>';
    style(query("#clip"), { overflowX: "auto" });
    setRect(query("#clip"), { left: 0, right: 600 });
    setRect(query("#wide"), { left: 0, right: 600 });

    expect(main.measurePage().overflowing).toEqual([
      { selector: "div#clip", left: 0, right: 600 },
      { selector: "div#wide", left: 0, right: 600 },
    ]);
  });

  it("ignora elementos ocultos e sem dimensão", () => {
    setViewport(500, 500);
    document.body.innerHTML = [
      '<div id="hidden"></div>',
      '<div id="invisible"></div>',
      '<div id="zero"></div>',
    ].join("");
    style(query("#hidden"), { display: "none" });
    style(query("#invisible"), { visibility: "hidden" });
    setRect(query("#hidden"), { left: 0, right: 600 });
    setRect(query("#invisible"), { left: 0, right: 600 });
    setRect(query("#zero"), { left: 0, right: 600, width: 0, height: 0 });

    expect(main.measurePage().overflowing).toEqual([]);
  });

  it("limita a três os elementos excedentes reportados", () => {
    setViewport(500, 600);
    document.body.innerHTML = [1, 2, 3, 4]
      .map((index) => `<div id="wide-${index}"></div>`)
      .join("");
    for (const index of [1, 2, 3, 4]) {
      setRect(query(`#wide-${index}`), { left: 0, right: 600 });
    }

    expect(main.measurePage().overflowing).toHaveLength(3);
  });

  it("mede conteúdo cortado pela borda do container e conta os alvos", () => {
    setViewport(500, 500);
    document.body.innerHTML = [
      '<div class="contact-list">',
      '<div class="contact-row-actions"></div>',
      '<div class="task-status"></div>',
      '<div class="task-status" id="vazio"></div>',
      "</div>",
    ].join("");
    style(query(".contact-list"), { overflowX: "hidden" });
    setRect(query(".contact-list"), { left: 0, right: 500 });
    setRect(query(".contact-row-actions"), { left: 400, right: 560 });
    // Excesso de exatamente 1px fica dentro da tolerância.
    setRect(query(".task-status:not(#vazio)"), { left: 400, right: 501 });
    setRect(query("#vazio"), { left: 400, right: 540, width: 0, height: 0 });

    const result = main.measurePage();

    expect(result.clipped).toEqual([
      {
        selector: "div.contact-row-actions",
        container: "div.contact-list",
        excess: 60,
        right: 560,
        edge: 500,
      },
    ]);
    expect(result.targetCounts).toEqual({
      ".contact-row-actions": 1,
      ".task-status": 2,
    });
  });
});

describe("withTimeout", () => {
  it("resolve quando a promessa termina antes do limite", async () => {
    await expect(
      main.withTimeout(Promise.resolve(42), 50, "/clientes"),
    ).resolves.toBe(42);
  });

  it("acrescenta o rótulo ao erro original", async () => {
    await expect(
      main.withTimeout(Promise.reject(new Error("net::ERR")), 50, "/clientes"),
    ).rejects.toThrow("net::ERR (/clientes)");
  });

  it("rejeita quando o tempo esgota", async () => {
    await expect(
      main.withTimeout(new Promise(() => {}), 5, "/tarefas"),
    ).rejects.toThrow(/tempo esgotado após 5ms \(\/tarefas\)/);
  });
});

describe("createWindow", () => {
  it("cria janela oculta com tamanho de conteúdo e sem integração com Node", () => {
    const instances: Array<{
      options: Record<string, unknown>;
      setMenuBarVisibility: ReturnType<typeof vi.fn>;
    }> = [];
    class FakeBrowserWindow {
      options: Record<string, unknown>;
      setMenuBarVisibility = vi.fn();
      constructor(options: Record<string, unknown>) {
        this.options = options;
        instances.push(this);
      }
    }

    const win = main.createWindow(375, 900, FakeBrowserWindow);

    expect(win).toBe(instances[0]);
    expect(instances[0].options).toMatchObject({
      show: false,
      width: 375,
      height: 900,
      useContentSize: true,
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    expect(instances[0].setMenuBarVisibility).toHaveBeenCalledWith(false);
  });
});

describe("applyViewport", () => {
  it("espera o redimensionamento assíncrono da janela", async () => {
    // No Linux o setContentSize aplica depois; medir antes lia a largura anterior.
    const win = {
      setContentSize: vi.fn(),
      webContents: {
        executeJavaScript: vi
          .fn()
          .mockResolvedValueOnce(360)
          .mockResolvedValueOnce(360)
          .mockResolvedValue(375),
      },
    };
    const delayImpl = vi.fn(async () => {});

    const width = await main.applyViewport(win, 375, 900, { delayImpl });

    expect(win.setContentSize).toHaveBeenCalledWith(375, 900);
    expect(width).toBe(375);
    expect(delayImpl).toHaveBeenCalledTimes(2);
  });

  it("devolve a última leitura quando a largura não chega no limite", async () => {
    const win = {
      setContentSize: vi.fn(),
      webContents: { executeJavaScript: vi.fn(async () => 1024) },
    };
    const delayImpl = vi.fn(async () => {});

    const width = await main.applyViewport(win, 1440, 900, {
      attempts: 3,
      delayImpl,
    });

    expect(width).toBe(1024);
    expect(delayImpl).toHaveBeenCalledTimes(3);
  });
});

describe("settle e loadRoute", () => {
  it("settle espera um tick do renderer e o relayout", async () => {
    const executeJavaScript = vi.fn(async () => true);
    const delayImpl = vi.fn(async () => {});

    await main.settle({ executeJavaScript }, { delayImpl });

    // rAF fica pausado em janela headless escondida; o tick usa timer.
    expect(executeJavaScript).toHaveBeenCalledWith(
      expect.stringContaining("setTimeout"),
      true,
    );
    expect(delayImpl).toHaveBeenCalledTimes(1);
  });

  it("loadRoute carrega a URL, espera as fontes e o layout estabilizar", async () => {
    const win = {
      loadURL: vi.fn(async () => {}),
      webContents: { executeJavaScript: vi.fn(async () => true) },
    };
    const waitForStableLayoutImpl = vi.fn(async () => {});

    await main.loadRoute(win, "http://localhost:3000/clientes", {
      waitForStableLayoutImpl,
    });

    expect(win.loadURL).toHaveBeenCalledWith("http://localhost:3000/clientes");
    expect(win.webContents.executeJavaScript).toHaveBeenCalledWith(
      "document.fonts.ready.then(() => true)",
      true,
    );
    expect(waitForStableLayoutImpl).toHaveBeenCalledWith(win.webContents);
  });

  it("loadRoute propaga falha de navegação com a URL no erro", async () => {
    const win = {
      loadURL: vi.fn(async () => {
        throw new Error("net::ERR_CONNECTION_REFUSED");
      }),
      webContents: { executeJavaScript: vi.fn(async () => true) },
    };

    await expect(
      main.loadRoute(win, "http://localhost:3000/tarefas"),
    ).rejects.toThrow(
      "net::ERR_CONNECTION_REFUSED (http://localhost:3000/tarefas)",
    );
  });
});

describe("waitForStableLayout", () => {
  it("retorna após duas medições iguais", async () => {
    const executeJavaScript = vi.fn(async () => "[600,900,1]");
    const delayImpl = vi.fn(async () => {});

    await main.waitForStableLayout(
      { executeJavaScript },
      { now: () => 0, delayImpl },
    );

    expect(executeJavaScript).toHaveBeenCalledTimes(3);
    expect(delayImpl).toHaveBeenCalledTimes(2);
  });

  it("desiste quando o layout não estabiliza até o limite", async () => {
    let clock = 0;
    const now = vi.fn(() => {
      const current = clock;
      clock += 400;
      return current;
    });
    const executeJavaScript = vi.fn(async () => `[${clock},900,0]`);
    const delayImpl = vi.fn(async () => {});

    await main.waitForStableLayout(
      { executeJavaScript },
      { now, delayImpl, timeoutMs: 1000 },
    );

    expect(executeJavaScript).toHaveBeenCalledTimes(2);
    expect(delayImpl).toHaveBeenCalledTimes(2);
  });
});

describe("run", () => {
  it("retorna 0 e destrói a janela quando não há problemas", async () => {
    const win = fakeWindow([
      measurement({ clientWidth: 600, scrollWidth: 600 }),
      measurement({ clientWidth: 601, scrollWidth: 601 }),
    ]);
    const log = logger();

    const code = await main.run({
      env: configEnv(baseConfig()),
      logger: log,
      BrowserWindow: browserWindow(win),
      loadRouteImpl: vi.fn(async () => {}),
      settleImpl: vi.fn(async () => {}),
    });

    expect(code).toBe(0);
    expect(win.setContentSize.mock.calls).toEqual([
      [600, 900],
      [601, 900],
    ]);
    expect(win.destroy).toHaveBeenCalledTimes(1);
    expect(log.log).toHaveBeenCalledWith("2 verificações, 0 problemas");
    expect(log.error).not.toHaveBeenCalled();
  });

  it("retorna 1 e reporta overflow, corte e viewport divergente", async () => {
    const win = fakeWindow([
      measurement({
        clientWidth: 600,
        scrollWidth: 620,
        overflowing: [{ selector: "div#wide", left: 0, right: 620 }],
        clipped: [
          {
            selector: "div.contact-row-actions",
            container: "div.contact-list",
            excess: 20,
            right: 620,
            edge: 600,
          },
        ],
      }),
      measurement({ clientWidth: 603, scrollWidth: 603 }),
    ]);
    const log = logger();

    const code = await main.run({
      env: configEnv(baseConfig()),
      logger: log,
      BrowserWindow: browserWindow(win),
      loadRouteImpl: vi.fn(async () => {}),
      settleImpl: vi.fn(async () => {}),
    });

    const output = log.log.mock.calls.flat().join("\n");
    expect(code).toBe(1);
    expect(output).toContain("overflow de página");
    expect(output).toContain("elementos além da viewport: div#wide");
    expect(output).toContain(
      "div.contact-row-actions excede div.contact-list em 20px",
    );
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("viewport diferente da largura pedida"),
    );
    expect(output).toContain("2 verificações, 2 problemas");
  });

  it("continua nas rotas seguintes quando uma falha ao carregar", async () => {
    const win = fakeWindow([measurement()]);
    const log = logger();
    const loadRouteImpl = vi.fn(async (_win: unknown, url: string) => {
      if (url.endsWith("/tarefas")) throw new Error("net::ERR");
    });

    const code = await main.run({
      env: configEnv(
        baseConfig({ routes: ["/tarefas", "/clientes"], widths: [600] }),
      ),
      logger: log,
      BrowserWindow: browserWindow(win),
      loadRouteImpl,
      settleImpl: vi.fn(async () => {}),
    });

    expect(code).toBe(1);
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "/tarefas @ todas: falha ao carregar http://localhost:3000/tarefas",
      ),
    );
    expect(log.log).toHaveBeenCalledWith("1 verificações, 1 problemas");
    expect(win.destroy).toHaveBeenCalledTimes(1);
  });

  it("aborta com erro claro quando a viewport tem largura 0", async () => {
    const win = fakeWindow([measurement({ clientWidth: 0, scrollWidth: 0 })]);

    await expect(
      main.run({
        env: configEnv(baseConfig({ widths: [600] })),
        logger: logger(),
        BrowserWindow: browserWindow(win),
        loadRouteImpl: vi.fn(async () => {}),
        settleImpl: vi.fn(async () => {}),
      }),
    ).rejects.toThrow(
      "viewport com largura 0 em /clientes @ 600px; a janela não renderizou.",
    );
    expect(win.destroy).toHaveBeenCalledTimes(1);
  });

  it("avisa quando a rota não renderizou nenhum alvo", async () => {
    const win = fakeWindow([
      measurement({ targetCounts: { ".contact-row-actions": 0 } }),
    ]);
    const log = logger();

    const code = await main.run({
      env: configEnv(
        baseConfig({
          routes: ["/contatos"],
          widths: [600],
          targets: { "/contatos": ".contact-row-actions" },
        }),
      ),
      logger: log,
      BrowserWindow: browserWindow(win),
      loadRouteImpl: vi.fn(async () => {}),
      settleImpl: vi.fn(async () => {}),
    });

    expect(code).toBe(0);
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Aviso: /contatos não renderizou nenhum ".contact-row-actions"',
      ),
    );
  });

  it("resume mais de três viewports divergentes sem listar todas", async () => {
    const widths = [500, 501, 502, 503, 504];
    const win = fakeWindow(
      widths.map((width) =>
        measurement({ clientWidth: width + 5, scrollWidth: width + 5 }),
      ),
    );
    const log = logger();

    const code = await main.run({
      env: configEnv(baseConfig({ widths })),
      logger: log,
      BrowserWindow: browserWindow(win),
      loadRouteImpl: vi.fn(async () => {}),
      settleImpl: vi.fn(async () => {}),
    });

    expect(code).toBe(0);
    const warning = log.error.mock.calls.flat().join("\n");
    expect(warning).toContain(
      "5 medições usaram viewport diferente da largura pedida",
    );
    expect(warning).toContain("; ...");
  });
});

describe("start e exitAfterFlush", () => {
  function fakeApp(overrides: Record<string, unknown> = {}) {
    return {
      disableHardwareAcceleration: vi.fn(),
      commandLine: { appendSwitch: vi.fn() },
      whenReady: vi.fn(async () => {}),
      exit: vi.fn(),
      ...overrides,
    };
  }

  function fakeWinForStart() {
    return {
      loadURL: vi.fn(async () => {
        throw new Error("net::ERR");
      }),
      setContentSize: vi.fn(),
      setMenuBarVisibility: vi.fn(),
      destroy: vi.fn(),
      webContents: { executeJavaScript: vi.fn(async () => true) },
    };
  }

  it("configura os switches do Chromium e encerra com o código do run", async () => {
    const app = fakeApp();
    const win = fakeWinForStart();
    const write = vi.spyOn(process.stdout, "write").mockImplementation(((
      ...args: unknown[]
    ) => {
      const callback = args[args.length - 1];
      if (typeof callback === "function") callback();
      return true;
    }) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env[main.CONFIG_ENV] = JSON.stringify(baseConfig());

    main.start({ electron: { app, BrowserWindow: browserWindow(win) } });

    await vi.waitFor(() => expect(app.exit).toHaveBeenCalledWith(1));
    expect(app.disableHardwareAcceleration).toHaveBeenCalledTimes(1);
    expect(app.commandLine.appendSwitch.mock.calls).toEqual([
      ["ozone-platform", "headless"],
      ["disable-gpu"],
    ]);
    expect(write).toHaveBeenCalled();
    expect(win.destroy).toHaveBeenCalled();
  });

  it("encerra com exit 1 quando app.whenReady rejeita", async () => {
    const app = fakeApp({
      whenReady: vi.fn(async () => {
        throw new Error("falha no Electron");
      }),
    });
    vi.spyOn(process.stdout, "write").mockImplementation(((
      ...args: unknown[]
    ) => {
      const callback = args[args.length - 1];
      if (typeof callback === "function") callback();
      return true;
    }) as never);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    main.start({ electron: { app, BrowserWindow: browserWindow({}) } });

    await vi.waitFor(() => expect(app.exit).toHaveBeenCalledWith(1));
    expect(error.mock.calls.flat().join("\n")).toContain("falha no Electron");
  });

  it("exitAfterFlush encerra com o código recebido", () => {
    const app = { exit: vi.fn() };
    vi.spyOn(process.stdout, "write").mockImplementation(((
      ...args: unknown[]
    ) => {
      const callback = args[args.length - 1];
      if (typeof callback === "function") callback();
      return true;
    }) as never);

    main.exitAfterFlush(app, 7);

    expect(app.exit).toHaveBeenCalledWith(7);
  });
});
