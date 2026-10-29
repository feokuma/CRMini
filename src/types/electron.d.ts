export {};

declare global {
  /** Estados do controlador em `electron/updater.cjs`. */
  type UpdateStatus =
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "installing"
    | "error";

  /**
   * Snapshot de `updates:get-state`/`updates:state`. Os campos opcionais só
   * aparecem quando o controlador tem o dado correspondente.
   */
  interface UpdateSnapshot {
    enabled: boolean;
    reason?: "development" | "portable" | "opt-out";
    status: UpdateStatus;
    currentVersion: string;
    targetVersion?: string;
    progress?: {
      percent: number;
      transferred: number;
      total: number;
      bytesPerSecond: number;
    };
    error?: {
      phase: "check" | "download" | "install";
      message: string;
      visible: boolean;
    };
    checkedAt?: string;
  }

  interface Window {
    crmDesktop?: {
      getDatabasePath(): Promise<string | null>;
      chooseDatabase(): Promise<{
        ok: boolean;
        canceled?: boolean;
        restarting?: boolean;
        unchanged?: boolean;
        error?: string;
      }>;
      // Opcional: o renderer também roda fora do Electron (navegador/dev).
      updates?: {
        getState(): Promise<UpdateSnapshot>;
        check(): Promise<{
          ok: boolean;
          error?: string;
          snapshot: UpdateSnapshot;
        }>;
        download(): Promise<{
          ok: boolean;
          error?: string;
          snapshot: UpdateSnapshot;
        }>;
        install(): Promise<{
          ok: boolean;
          error?: string;
          snapshot: UpdateSnapshot;
        }>;
        onState(listener: (snapshot: UpdateSnapshot) => void): () => void;
      };
    };
  }
}
