export const SIDEBAR_COLLAPSED_KEY = "crmini.sidebar.collapsed";

/** Ponte opcional exposta pelo preload do Electron. */
export interface SidebarPreferenceBridge {
  getSidebarCollapsed?(): Promise<boolean>;
  setSidebarCollapsed?(
    collapsed: boolean,
  ): Promise<{ ok: boolean; error?: string }>;
}

function bridge(): SidebarPreferenceBridge | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.crmDesktop;
  } catch {
    return undefined;
  }
}

function readFromStorage(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeToStorage(collapsed: boolean): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  } catch {
    // localStorage indisponível: a preferência simplesmente não é retida.
  }
}

// No Electron a preferência vem de `userData/preferences.json`; no navegador,
// de localStorage (a origem muda a cada execução do servidor).
export async function readSidebarCollapsed(): Promise<boolean> {
  try {
    const desktop = bridge();
    if (typeof desktop?.getSidebarCollapsed === "function") {
      const stored = await desktop.getSidebarCollapsed();
      if (typeof stored === "boolean") return stored;
    }
  } catch {
    // Falha ou ausência do IPC: cai para localStorage.
  }
  return readFromStorage();
}

export async function writeSidebarCollapsed(collapsed: boolean): Promise<void> {
  try {
    const desktop = bridge();
    if (typeof desktop?.setSidebarCollapsed === "function") {
      const result = await desktop.setSidebarCollapsed(collapsed);
      if (!(result && result.ok === false)) {
        // IPC aceitou a escrita: não duplica em localStorage.
        return;
      }
    }
  } catch {
    // Falha no IPC: grava em localStorage como fallback.
  }
  writeToStorage(collapsed);
}
