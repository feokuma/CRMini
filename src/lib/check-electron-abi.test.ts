import { createRequire } from "node:module";
import { expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { checkElectronAbi } =
  require("../../scripts/check-electron-abi.cjs") as {
    checkElectronAbi: (options: Record<string, unknown>) => number;
  };

it("retorna 0 quando o Electron carrega o better-sqlite3", () => {
  const spawner = vi.fn(() => ({ status: 0 }));
  const logger = { error: vi.fn() };

  const result = checkElectronAbi({
    electronBinary: "/electron",
    spawner,
    logger,
  });

  expect(result).toBe(0);
  expect(spawner).toHaveBeenCalledWith(
    "/electron",
    ["-e", "require('better-sqlite3')"],
    expect.objectContaining({
      env: expect.objectContaining({ ELECTRON_RUN_AS_NODE: "1" }),
    }),
  );
  expect(logger.error).not.toHaveBeenCalled();
});

it("explica a ABI incompatível e retorna 1", () => {
  const logger = { error: vi.fn() };

  const result = checkElectronAbi({
    electronBinary: "/electron",
    spawner: () => ({ status: 1, stderr: "NODE_MODULE_VERSION 147" }),
    logger,
  });

  expect(result).toBe(1);
  const output = logger.error.mock.calls.flat().join("\n");
  expect(output).toContain("better-sqlite3 não carrega no Electron");
  expect(output).toContain("NODE_MODULE_VERSION 147");
  expect(output).toContain("better-sqlite3");
});

it("retorna 1 quando não consegue executar o Electron", () => {
  const logger = { error: vi.fn() };

  const result = checkElectronAbi({
    electronBinary: "/electron",
    spawner: () => ({ error: new Error("ENOENT") }),
    logger,
  });

  expect(result).toBe(1);
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("ENOENT"));
});
