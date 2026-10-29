import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);

type UpdateSnapshot = {
  enabled: boolean;
  status: string;
  currentVersion: string;
};

type UpdateBridge = {
  getState: () => Promise<unknown>;
  check: () => Promise<unknown>;
  download: () => Promise<unknown>;
  install: () => Promise<unknown>;
  onState: (listener: (snapshot: UpdateSnapshot) => void) => () => void;
};

type Bridge = {
  getDatabasePath: () => Promise<unknown>;
  chooseDatabase: () => Promise<unknown>;
  getAssetsPath: () => Promise<unknown>;
  updates: UpdateBridge;
};

type LoadOverrides = {
  invoke?: ReturnType<typeof vi.fn>;
  on?: ReturnType<typeof vi.fn>;
  removeListener?: ReturnType<typeof vi.fn>;
};

// Executa `electron/preload.cjs` em um contexto isolado, com um ipcRenderer
// falso, para verificar exatamente o que atravessa o contextBridge.
function loadPreload(overrides: LoadOverrides = {}) {
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
  const invoke = overrides.invoke ?? vi.fn();
  const on = overrides.on ?? vi.fn();
  const removeListener = overrides.removeListener ?? vi.fn();
  const ipcRenderer = { invoke, on, removeListener };
  const sandboxRequire = (id: string) => {
    if (id === "electron") return { contextBridge, ipcRenderer };
    throw new Error(`Requisição inesperada no preload: ${id}`);
  };

  vm.runInNewContext(source, { require: sandboxRequire });

  return { exposed, contextBridge, invoke, on, removeListener };
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
        getAssetsPath: expect.any(Function),
        chooseDatabase: expect.any(Function),
        updates: expect.any(Object),
      }),
    );
  });

  it("encaminha cada método de banco para o canal IPC esperado", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce("/user/crm.sqlite")
      .mockResolvedValueOnce("/user/assets")
      .mockResolvedValueOnce({ ok: true });
    const { exposed } = loadPreload({ invoke });
    const bridge = exposed.crmDesktop as Bridge;

    await expect(bridge.getDatabasePath()).resolves.toBe("/user/crm.sqlite");
    await expect(bridge.getAssetsPath()).resolves.toBe("/user/assets");
    await expect(bridge.chooseDatabase()).resolves.toEqual({ ok: true });

    expect(invoke).toHaveBeenNthCalledWith(1, "database:get-path");
    expect(invoke).toHaveBeenNthCalledWith(2, "assets:get-path");
    expect(invoke).toHaveBeenNthCalledWith(3, "database:choose");
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it("encaminha updates para os canais IPC esperados", async () => {
    const snapshot: UpdateSnapshot = {
      enabled: true,
      status: "idle",
      currentVersion: "0.2.0",
    };
    const invoke = vi
      .fn()
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce({ ok: true, snapshot })
      .mockResolvedValueOnce({ ok: true, snapshot })
      .mockResolvedValueOnce({ ok: true, snapshot });
    const { exposed } = loadPreload({ invoke });
    const updates = (exposed.crmDesktop as Bridge).updates;

    await expect(updates.getState()).resolves.toEqual(snapshot);
    await expect(updates.check()).resolves.toEqual({ ok: true, snapshot });
    await expect(updates.download()).resolves.toEqual({ ok: true, snapshot });
    await expect(updates.install()).resolves.toEqual({ ok: true, snapshot });

    expect(invoke).toHaveBeenNthCalledWith(1, "updates:get-state");
    expect(invoke).toHaveBeenNthCalledWith(2, "updates:check");
    expect(invoke).toHaveBeenNthCalledWith(3, "updates:download");
    expect(invoke).toHaveBeenNthCalledWith(4, "updates:install");
    expect(invoke).toHaveBeenCalledTimes(4);
  });

  it("expõe updates com getState, check, download, install e onState", () => {
    const { exposed } = loadPreload();
    const updates = (exposed.crmDesktop as Bridge).updates;

    expect(Object.keys(updates).sort()).toEqual([
      "check",
      "download",
      "getState",
      "install",
      "onState",
    ]);
    for (const name of Object.keys(updates)) {
      expect(typeof updates[name as keyof UpdateBridge]).toBe("function");
    }
  });

  it("não expõe ipcRenderer nem canais arbitrários ao renderer", () => {
    const { exposed } = loadPreload();
    const bridge = exposed.crmDesktop as Record<string, unknown>;

    expect(Object.keys(bridge).sort()).toEqual([
      "chooseDatabase",
      "getAssetsPath",
      "getDatabasePath",
      "updates",
    ]);
    expect(bridge).not.toHaveProperty("ipcRenderer");
    expect(bridge).not.toHaveProperty("send");
    expect(bridge).not.toHaveProperty("on");
    expect(typeof bridge.getDatabasePath).toBe("function");
    expect(typeof bridge.chooseDatabase).toBe("function");
  });
});

describe("preload do Electron: updates.onState", () => {
  it("assina updates:state e repassa apenas o snapshot", () => {
    const { exposed, on } = loadPreload();
    const updates = (exposed.crmDesktop as Bridge).updates;
    const listener = vi.fn();

    updates.onState(listener);

    expect(on).toHaveBeenCalledTimes(1);
    const [channel, handler] = on.mock.calls[0] as [
      string,
      (event: unknown, snapshot: UpdateSnapshot) => void,
    ];
    expect(channel).toBe("updates:state");

    const snapshot: UpdateSnapshot = {
      enabled: true,
      status: "available",
      currentVersion: "0.2.0",
    };
    handler({ sender: "janela" }, snapshot);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(snapshot);
    // O `event` do IPC dá acesso ao remetente e não pode chegar ao renderer.
    expect(listener.mock.calls[0]).toHaveLength(1);
  });

  it("rejeita listener que não é função", () => {
    const { exposed, on } = loadPreload();
    const updates = (exposed.crmDesktop as Bridge).updates;

    // O erro nasce no contexto do sandbox, então não é `instanceof TypeError`
    // do realm do teste: o nome do erro é o que o renderer observa.
    let caught: unknown;
    try {
      updates.onState(null as unknown as (snapshot: UpdateSnapshot) => void);
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      name: "TypeError",
      message: "onState exige uma função.",
    });
    expect(on).not.toHaveBeenCalled();
  });

  it("unsubscribe remove exatamente o handler registrado", () => {
    const { exposed, on, removeListener } = loadPreload();
    const updates = (exposed.crmDesktop as Bridge).updates;
    const listener = vi.fn();

    const unsubscribe = updates.onState(listener);
    const handler = on.mock.calls[0][1] as (event: unknown) => void;

    unsubscribe();

    expect(removeListener).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalledWith("updates:state", handler);
  });
});
