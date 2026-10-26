"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [path, setPath] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const bridge = window.crmDesktop;
    if (!bridge) return;
    setAvailable(true);
    bridge.getDatabasePath().then((databasePath) => {
      if (!databasePath) throw new Error("O caminho do banco não está disponível.");
      setPath(databasePath);
    }).catch(() => setError("Não foi possível consultar o banco configurado. Tente novamente ou reinicie o aplicativo.")).finally(() => setLoading(false));
    setLoading(true);
  }, []);

  async function changeDatabase() {
    setError("");
    try {
      const result = await window.crmDesktop?.chooseDatabase();
      if (result?.error) setError(result.error);
    } catch {
      setError("Não foi possível abrir o seletor de banco de dados. Tente novamente.");
    }
  }

  return <main className="content"><header className="page-header"><div><p className="eyebrow">PREFERÊNCIAS</p><h1>Configurações</h1></div></header>
    {!available ? <p role="status">Configurações de banco disponíveis somente no aplicativo desktop.</p> : <section aria-labelledby="database-setting"><h2 id="database-setting">Banco de dados</h2><p>Caminho atual</p><p>{loading ? "Carregando caminho…" : path || "Caminho indisponível"}</p><button type="button" onClick={changeDatabase} disabled={loading || !path}>Trocar banco de dados</button><p>O aplicativo será reiniciado após a confirmação. O banco anterior não será movido nem apagado.</p>{error && <p role="alert">{error}</p>}</section>}
  </main>;
}
