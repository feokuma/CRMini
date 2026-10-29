import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);

type FakeLogger = { debug?: ReturnType<typeof vi.fn> };
type ServerShutdown = {
  stopOnce: () => Promise<void>;
  reset: () => void;
  readonly stopped: boolean;
};

const { createServerShutdown } =
  require("../../electron/server-shutdown.cjs") as {
    createServerShutdown: (options: {
      stop: () => unknown;
      logger?: FakeLogger;
    }) => ServerShutdown;
  };

function setup(stop: () => unknown, logger?: FakeLogger) {
  const fakeLogger = logger ?? { debug: vi.fn() };
  const shutdown = createServerShutdown({ stop, logger: fakeLogger });
  return { shutdown, logger: fakeLogger };
}

// Drena só microtasks: as promessas internas resolvem sem timer, mas nunca
// dependemos de um tick do event loop para saber se `stop` já rodou.
async function drainMicrotasks() {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
}

// Controla quando a parada em curso termina, sem relógio real.
function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("createServerShutdown", () => {
  it("chamadas concorrentes usam uma única parada e a mesma promessa", async () => {
    const pendingStop = deferred();
    const stop = vi.fn(() => pendingStop.promise);
    const { shutdown, logger } = setup(stop);

    const first = shutdown.stopOnce();
    const second = shutdown.stopOnce();

    expect(second).toBe(first);
    await drainMicrotasks();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      "Parada do servidor já em andamento; aguardando a mesma.",
    );
    // Ainda em andamento: não pode ser considerada parada.
    expect(shutdown.stopped).toBe(false);

    pendingStop.resolve();

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(shutdown.stopped).toBe(true);
  });

  it("stopped só vira true depois que stop resolve", async () => {
    const pendingStop = deferred();
    const stop = vi.fn(() => pendingStop.promise);
    const { shutdown } = setup(stop);

    const pending = shutdown.stopOnce();
    await drainMicrotasks();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(shutdown.stopped).toBe(false);

    pendingStop.resolve();
    await pending;

    expect(shutdown.stopped).toBe(true);
  });

  it("propaga a rejeição a todos os chamadores e permite nova tentativa", async () => {
    const stop = vi
      .fn()
      .mockRejectedValueOnce(new Error("falha ao parar"))
      .mockResolvedValueOnce(undefined);
    const { shutdown } = setup(stop);

    const first = shutdown.stopOnce();
    const second = shutdown.stopOnce();
    expect(second).toBe(first);

    const settled = await Promise.allSettled([first, second]);

    expect(settled.map((result) => result.status)).toEqual([
      "rejected",
      "rejected",
    ]);
    for (const result of settled) {
      expect(result.status === "rejected" && String(result.reason)).toContain(
        "falha ao parar",
      );
    }
    // Falha não conta como parado nem fixa a promessa rejeitada.
    expect(shutdown.stopped).toBe(false);
    expect(stop).toHaveBeenCalledTimes(1);

    await expect(shutdown.stopOnce()).resolves.toBeUndefined();

    expect(stop).toHaveBeenCalledTimes(2);
    expect(shutdown.stopped).toBe(true);
  });

  it("stop que lança sincronamente vira rejeição tratada", async () => {
    const stop = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("erro síncrono");
      })
      .mockResolvedValueOnce(undefined);
    const { shutdown } = setup(stop);

    const first = shutdown.stopOnce();
    const second = shutdown.stopOnce();
    expect(second).toBe(first);

    const settled = await Promise.allSettled([first, second]);

    expect(settled.map((result) => result.status)).toEqual([
      "rejected",
      "rejected",
    ]);
    expect(shutdown.stopped).toBe(false);
    expect(stop).toHaveBeenCalledTimes(1);

    // A exceção síncrona não envenena o módulo: a próxima parada funciona.
    await expect(shutdown.stopOnce()).resolves.toBeUndefined();
    expect(stop).toHaveBeenCalledTimes(2);
    expect(shutdown.stopped).toBe(true);
  });

  it("depois de parado não chama stop de novo e reset reabilita a parada", async () => {
    const stop = vi.fn(async () => {});
    const { shutdown } = setup(stop);

    await shutdown.stopOnce();
    expect(shutdown.stopped).toBe(true);

    await expect(shutdown.stopOnce()).resolves.toBeUndefined();
    expect(stop).toHaveBeenCalledTimes(1);

    shutdown.reset();

    expect(shutdown.stopped).toBe(false);
    await shutdown.stopOnce();
    expect(stop).toHaveBeenCalledTimes(2);
    expect(shutdown.stopped).toBe(true);
  });

  it("funciona com logger sem debug e não dispara segunda parada concorrente", async () => {
    const pendingStop = deferred();
    const stop = vi.fn(() => pendingStop.promise);
    const { shutdown } = setup(stop, {});

    const first = shutdown.stopOnce();
    const second = shutdown.stopOnce();

    expect(second).toBe(first);
    await drainMicrotasks();
    expect(stop).toHaveBeenCalledTimes(1);

    pendingStop.resolve();
    await Promise.all([first, second]);

    expect(stop).toHaveBeenCalledTimes(1);
    expect(shutdown.stopped).toBe(true);
  });

  it("usa console como logger padrão sem quebrar a chamada concorrente", async () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const pendingStop = deferred();
    const stop = vi.fn(() => pendingStop.promise);
    const shutdown = createServerShutdown({ stop });

    const first = shutdown.stopOnce();
    const second = shutdown.stopOnce();
    await drainMicrotasks();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(debug).toHaveBeenCalledTimes(1);

    pendingStop.resolve();
    await Promise.all([first, second]);
    expect(shutdown.stopped).toBe(true);
  });
});
