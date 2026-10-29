import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SIDEBAR_COLLAPSED_KEY,
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from "./sidebar-preference";

type DesktopBridge = NonNullable<Window["crmDesktop"]>;

/** Instala a ponte do preload com os métodos base e os overrides do caso. */
function setBridge(overrides: Record<string, unknown> = {}) {
  window.crmDesktop = {
    getDatabasePath: vi.fn(async () => null),
    getAssetsPath: vi.fn(async () => null),
    chooseDatabase: vi.fn(async () => ({ ok: true })),
    ...overrides,
  } as unknown as DesktopBridge;
}

afterEach(() => {
  delete window.crmDesktop;
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("readSidebarCollapsed", () => {
  it("usa o booleano true da ponte desktop sem ler o localStorage", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    setBridge({ getSidebarCollapsed: vi.fn(async () => true) });

    await expect(readSidebarCollapsed()).resolves.toBe(true);

    expect(getItem).not.toHaveBeenCalled();
  });

  it("usa o booleano false da ponte desktop sem ler o localStorage", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    setBridge({ getSidebarCollapsed: vi.fn(async () => false) });

    await expect(readSidebarCollapsed()).resolves.toBe(false);

    expect(getItem).not.toHaveBeenCalled();
  });

  it("cai para o localStorage quando não existe ponte desktop", async () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");

    await expect(readSidebarCollapsed()).resolves.toBe(true);
  });

  it("trata ausência e o valor false do localStorage como expandida", async () => {
    await expect(readSidebarCollapsed()).resolves.toBe(false);

    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "false");
    await expect(readSidebarCollapsed()).resolves.toBe(false);
  });

  it("ignora uma ponte sem getSidebarCollapsed e usa o localStorage", async () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
    setBridge();

    await expect(readSidebarCollapsed()).resolves.toBe(true);
  });

  it("cai para o localStorage quando o IPC rejeita", async () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
    setBridge({
      getSidebarCollapsed: vi.fn(async () => {
        throw new Error("IPC indisponível");
      }),
    });

    await expect(readSidebarCollapsed()).resolves.toBe(true);
  });

  it.each(["true", 1, null, undefined, {}])(
    "cai para o localStorage quando o IPC devolve valor não-booleano (%s)",
    async (stored) => {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "false");
      setBridge({ getSidebarCollapsed: vi.fn(async () => stored) });

      await expect(readSidebarCollapsed()).resolves.toBe(false);
    },
  );

  it("retorna expandida sem propagar erro quando o storage falha", async () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage bloqueado");
    });

    await expect(readSidebarCollapsed()).resolves.toBe(false);
  });
});

describe("writeSidebarCollapsed", () => {
  it("grava via ponte desktop e não duplica no localStorage", async () => {
    const setSidebarCollapsed = vi.fn(async () => ({ ok: true }));
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    setBridge({ setSidebarCollapsed });

    await expect(writeSidebarCollapsed(true)).resolves.toBeUndefined();

    expect(setSidebarCollapsed).toHaveBeenCalledWith(true);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("considera sucesso um IPC que resolve undefined", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    setBridge({ setSidebarCollapsed: vi.fn(async () => undefined) });

    await expect(writeSidebarCollapsed(false)).resolves.toBeUndefined();

    expect(setItem).not.toHaveBeenCalled();
  });

  it("grava no localStorage quando o IPC responde ok: false", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    setBridge({
      setSidebarCollapsed: vi.fn(async () => ({
        ok: false,
        error: "Não foi possível salvar a preferência.",
      })),
    });

    await expect(writeSidebarCollapsed(true)).resolves.toBeUndefined();

    expect(setItem).toHaveBeenCalledWith(SIDEBAR_COLLAPSED_KEY, "true");
  });

  it("grava no localStorage quando o IPC rejeita", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    setBridge({
      setSidebarCollapsed: vi.fn(async () => {
        throw new Error("IPC indisponível");
      }),
    });

    await expect(writeSidebarCollapsed(false)).resolves.toBeUndefined();

    expect(setItem).toHaveBeenCalledWith(SIDEBAR_COLLAPSED_KEY, "false");
  });

  it("grava no localStorage quando não existe ponte desktop", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    await expect(writeSidebarCollapsed(true)).resolves.toBeUndefined();

    expect(setItem).toHaveBeenCalledWith(SIDEBAR_COLLAPSED_KEY, "true");
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("true");
  });

  it("ignora uma ponte sem setSidebarCollapsed e grava no localStorage", async () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
    setBridge({ getSidebarCollapsed: vi.fn(async () => true) });

    await expect(writeSidebarCollapsed(false)).resolves.toBeUndefined();

    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("false");
  });

  it("resolve sem erro quando o storage também falha na escrita", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage bloqueado");
    });

    await expect(writeSidebarCollapsed(true)).resolves.toBeUndefined();
  });
});
