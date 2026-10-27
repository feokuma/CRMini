import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { applyMigrations } =
  require("../../electron/database-migrations.cjs") as {
    applyMigrations: (options: {
      databasePath?: string;
      spawner?: (...args: unknown[]) => unknown;
      execPath?: string;
      migrateScript?: string;
      cwd?: string;
      env?: NodeJS.ProcessEnv;
      timeoutMs?: number;
      killEscalationMs?: number;
    }) => Promise<string>;
  };

type FakeChild = EventEmitter & {
  stdout: PassThrough;
  stderr: PassThrough;
  kill: ReturnType<typeof vi.fn>;
};

function createChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn();
  return child;
}

function setup() {
  const child = createChild();
  const spawner = vi.fn(() => child);
  return { child, spawner };
}

const flushStreams = () => new Promise((resolve) => setImmediate(resolve));

afterEach(() => {
  vi.useRealTimers();
});

describe("applyMigrations", () => {
  it("resolve com o stdout quando o processo termina com código 0", async () => {
    const { child, spawner } = setup();
    const pending = applyMigrations({
      databasePath: "/tmp/crm.sqlite",
      spawner,
      env: {},
    });

    child.stdout.write("Banco atualizado com sucesso\n");
    await flushStreams();
    child.emit("close", 0);

    await expect(pending).resolves.toBe("Banco atualizado com sucesso\n");
    expect(spawner).toHaveBeenCalledOnce();
  });

  it("rejeita incluindo o stderr quando o código é diferente de 0", async () => {
    const { child, spawner } = setup();
    const pending = applyMigrations({
      databasePath: "/tmp/crm.sqlite",
      spawner,
      env: {},
    });

    child.stderr.write("banco bloqueado\n");
    await flushStreams();
    child.emit("close", 3);

    await expect(pending).rejects.toThrow(
      /Falha ao atualizar o banco \(código 3\): banco bloqueado/,
    );
  });

  it("rejeita quando o spawn lança", async () => {
    const spawner = vi.fn(() => {
      throw new Error("EACCES: permissão negada");
    });

    await expect(
      applyMigrations({
        databasePath: "/tmp/crm.sqlite",
        spawner,
        env: {},
      }),
    ).rejects.toThrow(
      /Não foi possível executar a atualização do banco: EACCES/,
    );
  });

  it("rejeita quando o processo emite error", async () => {
    const { child, spawner } = setup();
    const pending = applyMigrations({
      databasePath: "/tmp/crm.sqlite",
      spawner,
      env: {},
    });

    child.emit("error", new Error("ENOENT: executável ausente"));

    await expect(pending).rejects.toThrow(
      /Não foi possível executar a atualização do banco: ENOENT/,
    );
  });

  it("rejeita e mata o processo quando estoura o tempo limite", async () => {
    vi.useFakeTimers();
    const { child, spawner } = setup();
    const pending = applyMigrations({
      databasePath: "/tmp/crm.sqlite",
      spawner,
      env: {},
      timeoutMs: 500,
    });
    const rejected = expect(pending).rejects.toThrow(
      /Tempo limite de 500 ms excedido/,
    );

    vi.advanceTimersByTime(500);
    await rejected;

    expect(child.kill).toHaveBeenCalledWith("SIGTERM");

    vi.advanceTimersByTime(5000);
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  });

  it("passa execPath, script e banco, e preserva o env com ELECTRON_RUN_AS_NODE", async () => {
    const { child, spawner } = setup();
    const pending = applyMigrations({
      databasePath: "/tmp/crm.sqlite",
      spawner,
      execPath: "/opt/electron/electron",
      migrateScript: "/repo/database/migrate.cjs",
      env: { PATH: "/bin", HOME: "/home/test" },
    });

    expect(spawner).toHaveBeenCalledWith(
      "/opt/electron/electron",
      ["/repo/database/migrate.cjs", "/tmp/crm.sqlite"],
      {
        cwd: process.cwd(),
        env: {
          PATH: "/bin",
          HOME: "/home/test",
          ELECTRON_RUN_AS_NODE: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    child.emit("close", 0);
    await expect(pending).resolves.toBe("");
  });
});
