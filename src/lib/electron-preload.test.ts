import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
function loadPreload() {
  const source = fs.readFileSync(
    path.join(process.cwd(), "electron", "preload.cjs"),
    "utf8",
  );
  const exposed: Record<string, unknown> = {};
  const contextBridge = {
    exposeInMainWorld: vi.fn((key: string, api: unknown) => {
      exposed[key] = api;
    }),
  };
  const invoke = vi.fn();
  const sandboxRequire = (id: string) => {
    if (id === "electron") return { contextBridge, ipcRenderer: { invoke } };
    throw new Error(`Requisição inesperada no preload: ${id}`);
  };

  vm.runInNewContext(source, { require: sandboxRequire });

  return { exposed, contextBridge, invoke };
}

describe("preload do Electron", () => {
  it("expõe somente a API crmDesktop via contextBridge", () => {
    const { exposed, contextBridge } = loadPreload();

    expect(Object.keys(exposed)).toEqual(["crmDesktop"]);
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledTimes(1);
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      "crmDesktop",
      expect.objectContaining({
        getDatabasePath: expect.any(Function),
        chooseDatabase: expect.any(Function),
      }),
    );
  });

  it("encaminha cada método para o canal IPC esperado", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce("/user/crm.sqlite")
      .mockResolvedValueOnce({ ok: true });
    const { exposed } = loadPreloadWithInvoke(invoke);
    const bridge = exposed.crmDesktop as { getDatabasePath: () => Promise<unknown>; chooseDatabase: () => Promise<unknown> };

    await expect(bridge.getDatabasePath()).resolves.toBe("/user/crm.sqlite");
    await expect(bridge.chooseDatabase()).resolves.toEqual({ ok: true });

    expect(invoke).toHaveBeenNthCalledWith(1, "database:get-path");
    expect(invoke).toHaveBeenNthCalledWith(2, "database:choose");
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("não expõe ipcRenderer nem canais arbitrários ao renderer", () => {
    const { exposed } = loadPreload();
    const bridge = exposed.crmDesktop as Record<string, unknown>;

    expect(Object.keys(bridge).sort()).toEqual([
      "chooseDatabase",
      "getDatabasePath",
    ]);
    expect(bridge).not.toHaveProperty("ipcRenderer");
    expect(bridge).not.toHaveProperty("send");
    expect(bridge).not.toHaveProperty("on");
    expect(typeof bridge.getDatabasePath).toBe("function");
    expect(typeof bridge.chooseDatabase).toBe("function");
  });
});

function loadPreloadWithInvoke(invoke: ReturnType<typeof vi.fn>) {
  const source = fs.readFileSync(path.join(process.cwd(), "electron", "preload.cjs"), "utf8");
  const exposed: Record<string, unknown> = {};
  const contextBridge = { exposeInMainWorld: (_key: string, api: unknown) => { exposed.crmDesktop = api; } };
  vm.runInNewContext(source, { require: (id: string) => {
    if (id === "electron") return { contextBridge, ipcRenderer: { invoke } };
    throw new Error(`Requisição bloqueada no preload sandbox: ${id}`);
  } });
  return { exposed };
}
