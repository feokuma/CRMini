import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createServerLifecycle } = require("../../electron/server-lifecycle.cjs") as {
  createServerLifecycle: (options: Record<string, unknown>) => { start: (dbPath: string, options?: Record<string, unknown>) => Promise<string>; stop: () => Promise<void> };
};

it("inicia Next diretamente com caminho B e aguarda resposta no porto exclusivo", async () => {
  const child = new EventEmitter() as EventEmitter & { exitCode: number | null; signalCode: string | null; kill: ReturnType<typeof vi.fn> };
  child.exitCode = null;
  child.signalCode = null;
  child.kill = vi.fn(() => { child.exitCode = 0; child.emit("exit", 0); });
  const spawn = vi.fn(() => child);
  const request = vi.fn((_url: string, callback: (response: { resume: () => void }) => void) => {
    const req = new EventEmitter();
    queueMicrotask(() => callback({ resume() {} }));
    return req;
  });
  const server = createServerLifecycle({ processSpawner: spawn, projectDir: "/crm", isDevelopment: false, env: {} });

  const url = await server.start("/isolated/B.sqlite", { request });

  expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  expect(spawn).toHaveBeenCalledWith(process.execPath, [expect.stringContaining("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", expect.any(String)], expect.objectContaining({ env: expect.objectContaining({ SQLITE_PATH: "/isolated/B.sqlite" }) }));
  expect(spawn.mock.calls[0][2]).toMatchObject({ env: { ELECTRON_RUN_AS_NODE: "1" } });
  await server.stop();
  expect(child.kill).toHaveBeenCalledWith("SIGTERM");
});

it("mantém stop concorrente pendente até o processo confirmar saída", async () => {
  const child = new EventEmitter() as EventEmitter & { exitCode: number | null; signalCode: string | null; kill: ReturnType<typeof vi.fn> };
  child.exitCode = null;
  child.signalCode = null;
  child.kill = vi.fn();
  const server = createServerLifecycle({ processSpawner: () => child, projectDir: "/crm", isDevelopment: false, env: {} });
  const starting = server.start("/isolated/B.sqlite", { request: (_url: string, callback: (response: { resume: () => void }) => void) => { const req = new EventEmitter(); queueMicrotask(() => callback({ resume() {} })); return req; } });
  await starting;
  let resolved = false;
  const firstStop = server.stop().then(() => { resolved = true; });
  const secondStop = server.stop();
  await Promise.resolve();
  expect(resolved).toBe(false);
  expect(child.kill).toHaveBeenCalledOnce();
  child.exitCode = 0;
  child.emit("exit", 0);
  await Promise.all([firstStop, secondStop]);
  expect(resolved).toBe(true);
});

it("falha prontamente se o processo próprio morrer antes da readiness", async () => {
  const child = new EventEmitter() as EventEmitter & { exitCode: number | null; signalCode: string | null; kill: () => void };
  child.exitCode = null;
  child.signalCode = null;
  let spawned!: () => void;
  const spawnReady = new Promise<void>((resolve) => { spawned = resolve; });
  const server = createServerLifecycle({ processSpawner: () => { spawned(); return child; }, projectDir: "/crm", isDevelopment: true, env: {} });
  const pending = server.start("/isolated/B.sqlite", { request: () => new EventEmitter(), timeoutMs: 10000 });
  await spawnReady;
  child.emit("exit", 1);
  await expect(pending).rejects.toThrow(/encerrou antes de ficar pronto/);
});
