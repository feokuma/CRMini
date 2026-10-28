import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const layoutCheck = require("../../scripts/layout-check.cjs") as {
  HEIGHT: number;
  ROUTES: string[];
  WIDTHS: number[];
  canReachServer: (
    baseUrl: string,
    options?: { fetchImpl?: ReturnType<typeof vi.fn> },
  ) => Promise<{ ok: boolean; status?: number; error?: Error }>;
  formatUnreachableServer: (options: {
    baseUrl: string;
    result: { status?: number; error?: Error };
  }) => string;
  parseBaseUrl: (value?: string) => string;
  resolveElectronBinary: (options: { root: string }) => string | null;
  runLayoutCheck: (options?: Record<string, unknown>) => Promise<number>;
  spawnElectron: (options: Record<string, unknown>) => Promise<{
    code: number;
    error?: Error;
  }>;
};

const { HEIGHT, ROUTES, WIDTHS } = layoutCheck;

const temps: string[] = [];

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crm-layout-check-"));
  temps.push(root);
  return root;
}

function electronName() {
  return process.platform === "win32" ? "electron.exe" : "electron";
}

function rootWithElectron() {
  const root = tempRoot();
  const binary = path.join(
    root,
    "node_modules",
    "electron",
    "dist",
    electronName(),
  );
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.writeFileSync(binary, "");
  return { root, binary };
}

function fakeChild() {
  return new EventEmitter();
}

afterEach(() => {
  for (const dir of temps.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("listas de verificação", () => {
  // As larguras vizinhas dos breakpoints são o ponto do script: sem elas uma
  // regressão exatamente na transição de layout passaria batido.
  it("inclui as larguras vizinhas dos breakpoints 600/601, 680/681 e 900/901", () => {
    for (const width of [600, 601, 680, 681, 900, 901]) {
      expect(WIDTHS).toContain(width);
    }
  });

  it("mantém as larguras em ordem crescente e a altura padrão de 900px", () => {
    expect([...WIDTHS].sort((a, b) => a - b)).toEqual(WIDTHS);
    expect(HEIGHT).toBe(900);
  });

  it("cobre as rotas principais da aplicação com caminhos absolutos", () => {
    for (const route of ROUTES) {
      expect(route.startsWith("/")).toBe(true);
    }
    expect(ROUTES).toEqual(
      expect.arrayContaining([
        "/",
        "/clientes",
        "/contatos",
        "/oportunidades",
        "/tarefas",
        "/configuracoes",
      ]),
    );
  });
});

describe("parseBaseUrl", () => {
  it("usa http://localhost:3000 como padrão", () => {
    expect(layoutCheck.parseBaseUrl()).toBe("http://localhost:3000");
  });

  it("remove espaços e barras finais para evitar URL com //", () => {
    expect(layoutCheck.parseBaseUrl("  https://crm.example.com///  ")).toBe(
      "https://crm.example.com",
    );
  });

  it("rejeita valor que não é URL", () => {
    expect(() => layoutCheck.parseBaseUrl("localhost:3000")).toThrow(
      /LAYOUT_BASE_URL inválida/,
    );
  });

  it("rejeita protocolo diferente de http/https", () => {
    expect(() => layoutCheck.parseBaseUrl("ftp://localhost:3000")).toThrow(
      /Use http:\/\/ ou https:\/\//,
    );
  });
});

describe("resolveElectronBinary", () => {
  it("encontra o binário em node_modules/electron/dist", () => {
    const { root, binary } = rootWithElectron();

    expect(layoutCheck.resolveElectronBinary({ root })).toBe(binary);
  });

  it("devolve null quando o Electron não foi instalado", () => {
    expect(layoutCheck.resolveElectronBinary({ root: tempRoot() })).toBeNull();
  });
});

describe("canReachServer", () => {
  it("considera alcançável qualquer resposta abaixo de 500", async () => {
    const fetchImpl = vi.fn(async () => ({ status: 404 }));

    await expect(
      layoutCheck.canReachServer("http://localhost:3000", { fetchImpl }),
    ).resolves.toEqual({ ok: true, status: 404 });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:3000/",
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it("considera 5xx um servidor quebrado", async () => {
    const fetchImpl = vi.fn(async () => ({ status: 500 }));

    await expect(
      layoutCheck.canReachServer("http://localhost:3000", { fetchImpl }),
    ).resolves.toEqual({ ok: false, status: 500 });
  });

  it("devolve o erro quando a conexão falha", async () => {
    const error = new Error("ECONNREFUSED");
    const fetchImpl = vi.fn(async () => {
      throw error;
    });

    await expect(
      layoutCheck.canReachServer("http://localhost:3000", { fetchImpl }),
    ).resolves.toEqual({ ok: false, error });
  });
});

describe("formatUnreachableServer", () => {
  it("mostra o erro de conexão e instrui a iniciar o servidor", () => {
    const message = layoutCheck.formatUnreachableServer({
      baseUrl: "http://localhost:3000",
      result: { error: new Error("ECONNREFUSED") },
    });

    expect(message).toContain(
      "Servidor não respondeu em http://localhost:3000",
    );
    expect(message).toContain("ECONNREFUSED");
    expect(message).toContain("npm run dev");
  });

  it("usa o status HTTP quando não houve erro de conexão", () => {
    const message = layoutCheck.formatUnreachableServer({
      baseUrl: "http://localhost:3000",
      result: { status: 503 },
    });

    expect(message).toContain("status HTTP 503");
  });
});

describe("spawnElectron", () => {
  it("passa a configuração por LAYOUT_CHECK_CONFIG e propaga exit 0", async () => {
    const child = fakeChild();
    const spawnImpl = vi.fn(() => child);
    const config = { baseUrl: "http://localhost:3000", routes: ["/"] };

    const promise = layoutCheck.spawnElectron({
      binary: "/electron",
      config,
      env: { PATH: "/bin" },
      spawnImpl,
    });
    child.emit("exit", 0);

    await expect(promise).resolves.toEqual({ code: 0 });
    expect(spawnImpl).toHaveBeenCalledWith(
      "/electron",
      ["--no-sandbox", expect.stringContaining("layout-check-main.cjs")],
      expect.objectContaining({
        env: expect.objectContaining({
          PATH: "/bin",
          LAYOUT_CHECK_CONFIG: JSON.stringify(config),
        }),
        stdio: "inherit",
      }),
    );
  });

  it("trata exit nulo como falha", async () => {
    const child = fakeChild();
    const promise = layoutCheck.spawnElectron({
      binary: "/electron",
      config: {},
      env: {},
      spawnImpl: () => child,
    });
    child.emit("exit", null);

    await expect(promise).resolves.toEqual({ code: 1 });
  });

  it("resolve com erro quando o processo não pode ser executado", async () => {
    const child = fakeChild();
    const error = new Error("ENOENT");
    const promise = layoutCheck.spawnElectron({
      binary: "/electron",
      config: {},
      env: {},
      spawnImpl: () => child,
    });
    child.emit("error", error);

    await expect(promise).resolves.toEqual({ code: 1, error });
  });
});

describe("runLayoutCheck", () => {
  function logger() {
    return { log: vi.fn(), error: vi.fn() };
  }

  function spawnExiting(code: number) {
    return vi.fn(() => {
      const child = fakeChild();
      queueMicrotask(() => child.emit("exit", code));
      return child;
    });
  }

  function spawnFailing(error: Error) {
    return vi.fn(() => {
      const child = fakeChild();
      queueMicrotask(() => child.emit("error", error));
      return child;
    });
  }

  it("falha com exit 1 quando LAYOUT_BASE_URL é inválida", async () => {
    const log = logger();
    const fetchImpl = vi.fn();
    const spawnImpl = vi.fn();

    const code = await layoutCheck.runLayoutCheck({
      env: { LAYOUT_BASE_URL: "ftp://localhost:3000" },
      logger: log,
      fetchImpl,
      spawnImpl,
      root: rootWithElectron().root,
    });

    expect(code).toBe(1);
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("LAYOUT_BASE_URL inválida"),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it("falha com exit 1 quando o Electron não está instalado", async () => {
    const log = logger();
    const fetchImpl = vi.fn();

    const code = await layoutCheck.runLayoutCheck({
      env: {},
      logger: log,
      fetchImpl,
      root: tempRoot(),
    });

    expect(code).toBe(1);
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("npm install"),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falha com exit 1 quando o servidor não responde", async () => {
    const log = logger();
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });

    const code = await layoutCheck.runLayoutCheck({
      env: {},
      logger: log,
      fetchImpl,
      root: rootWithElectron().root,
    });

    expect(code).toBe(1);
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("ECONNREFUSED"),
    );
  });

  it("falha com exit 1 quando o servidor responde 5xx", async () => {
    const log = logger();
    const fetchImpl = vi.fn(async () => ({ status: 502 }));

    const code = await layoutCheck.runLayoutCheck({
      env: {},
      logger: log,
      fetchImpl,
      root: rootWithElectron().root,
    });

    expect(code).toBe(1);
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("status HTTP 502"),
    );
  });

  it("retorna 0 e monta a configuração quando o filho termina bem", async () => {
    const log = logger();
    const spawnImpl = spawnExiting(0);
    const fetchImpl = vi.fn(async () => ({ status: 200 }));

    const code = await layoutCheck.runLayoutCheck({
      env: { LAYOUT_BASE_URL: "http://localhost:3001/" },
      logger: log,
      fetchImpl,
      spawnImpl,
      root: rootWithElectron().root,
    });

    expect(code).toBe(0);
    const [, , options] = spawnImpl.mock.calls[0] as unknown as [
      string,
      string[],
      { env: Record<string, string> },
    ];
    const config = JSON.parse(options.env.LAYOUT_CHECK_CONFIG);
    expect(config).toEqual({
      baseUrl: "http://localhost:3001",
      routes: ROUTES,
      widths: WIDTHS,
      height: HEIGHT,
      targets: {
        "/contatos": ".contact-row-actions",
        "/tarefas": ".task-status",
      },
    });
    expect(log.log).toHaveBeenCalledWith(
      `Verificando http://localhost:3001: ${ROUTES.length} rotas × ${WIDTHS.length} larguras (altura ${HEIGHT}px).`,
    );
  });

  it("converte exit diferente de zero do filho em exit 1", async () => {
    const log = logger();

    const code = await layoutCheck.runLayoutCheck({
      env: {},
      logger: log,
      fetchImpl: vi.fn(async () => ({ status: 200 })),
      spawnImpl: spawnExiting(2),
      root: rootWithElectron().root,
    });

    expect(code).toBe(1);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("exit 2"));
  });

  it("converte erro ao executar o Electron em exit 1", async () => {
    const log = logger();

    const code = await layoutCheck.runLayoutCheck({
      env: {},
      logger: log,
      fetchImpl: vi.fn(async () => ({ status: 200 })),
      spawnImpl: spawnFailing(new Error("spawn EACCES")),
      root: rootWithElectron().root,
    });

    expect(code).toBe(1);
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("spawn EACCES"),
    );
  });
});
