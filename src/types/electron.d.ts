export {};

declare global {
  interface Window {
    crmDesktop?: {
      getDatabasePath(): Promise<string | null>;
      chooseDatabase(): Promise<{ ok: boolean; canceled?: boolean; restarting?: boolean; unchanged?: boolean; error?: string }>;
    };
  }
}
