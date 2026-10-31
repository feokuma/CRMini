"use client";

import Breadcrumbs from "@/components/breadcrumbs";
import { MAX_USER_NAME_LENGTH } from "@/lib/user-name";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [path, setPath] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [assetsPath, setAssetsPath] = useState<string | null>(null);
  const [assetsError, setAssetsError] = useState("");
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [userNameLoading, setUserNameLoading] = useState(true);
  const [userNameSaving, setUserNameSaving] = useState(false);
  const [userNameError, setUserNameError] = useState("");
  const [userNameSaved, setUserNameSaved] = useState(false);

  useEffect(() => {
    const bridge = window.crmDesktop;
    if (!bridge) return;

    let active = true;
    setAvailable(true);
    setLoading(true);
    setAssetsLoading(true);
    bridge
      .getDatabasePath()
      .then((databasePath) => {
        if (!databasePath)
          throw new Error("O caminho do banco não está disponível.");
        if (active) setPath(databasePath);
      })
      .catch(() => {
        if (active)
          setError(
            "Não foi possível consultar o banco configurado. Tente novamente ou reinicie o aplicativo.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    bridge
      .getAssetsPath()
      .then((assetsDir) => {
        if (active) setAssetsPath(assetsDir);
      })
      .catch(() => {
        if (active)
          setAssetsError(
            "Não foi possível consultar a pasta de imagens. Tente novamente ou reinicie o aplicativo.",
          );
      })
      .finally(() => {
        if (active) setAssetsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadUserName() {
      try {
        const response = await fetch("/api/settings");
        if (!response.ok) throw new Error("Falha ao carregar o nome.");
        const data = (await response.json()) as { userName?: string | null };
        if (active && typeof data.userName === "string")
          setUserName(data.userName);
      } catch {
        // O campo continua editável, mas o usuário precisa saber que o valor
        // atual não foi carregado antes de sobrescrevê-lo.
        if (active)
          setUserNameError("Não foi possível carregar o nome do usuário.");
      } finally {
        if (active) setUserNameLoading(false);
      }
    }
    void loadUserName();
    return () => {
      active = false;
    };
  }, []);

  async function changeDatabase() {
    setError("");
    try {
      const result = await window.crmDesktop?.chooseDatabase();
      if (result?.error) setError(result.error);
    } catch {
      setError(
        "Não foi possível abrir o seletor de banco de dados. Tente novamente.",
      );
    }
  }

  async function saveUserName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserNameError("");
    setUserNameSaved(false);
    setUserNameSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        userName?: string | null;
        error?: string;
      };
      if (!response.ok) {
        setUserNameError(
          data.error ?? "Não foi possível salvar as configurações.",
        );
        return;
      }
      setUserName(typeof data.userName === "string" ? data.userName : "");
      setUserNameSaved(true);
    } catch {
      setUserNameError("Não foi possível salvar as configurações.");
    } finally {
      setUserNameSaving(false);
    }
  }

  const userNameDescription =
    [
      "user-name-hint",
      userNameLoading ? "user-name-loading" : null,
      userNameError ? "user-name-error" : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const pathDescription =
    [
      loading ? "database-path-status" : null,
      error ? "database-path-error" : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const assetsPathDescription =
    [
      assetsLoading ? "assets-path-status" : null,
      assetsError ? "assets-path-error" : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <main className="records-page">
      <Breadcrumbs
        items={[{ label: "Meu espaço", href: "/" }, { label: "Configurações" }]}
      />
      <header className="records-header">
        <div>
          <p className="eyebrow">PREFERÊNCIAS</p>
          <h1>Configurações</h1>
          <p className="subheading">
            Ajustes do aplicativo e da origem dos dados.
          </p>
        </div>
      </header>
      <div className="settings-sections">
        <section className="form-section" aria-labelledby="profile-setting">
          <div className="form-section-heading">
            <div>
              <h2 id="profile-setting">Nome do usuário</h2>
              <p>Como você quer ser chamado nas saudações do painel.</p>
            </div>
          </div>
          <form className="settings-body" onSubmit={saveUserName}>
            <label className="form-field">
              <span>Seu nome</span>
              <input
                type="text"
                value={userName}
                onChange={(event) => {
                  setUserName(event.target.value);
                  setUserNameSaved(false);
                }}
                placeholder="Como você quer ser chamado"
                maxLength={MAX_USER_NAME_LENGTH}
                aria-describedby={userNameDescription}
                aria-invalid={userNameError ? true : undefined}
              />
            </label>
            {userNameLoading && (
              <p className="subheading" id="user-name-loading" role="status">
                Carregando nome…
              </p>
            )}
            <p className="subheading" id="user-name-hint">
              Deixe em branco para que as saudações apareçam sem nome.
            </p>
            {userNameError && (
              <p className="form-error" id="user-name-error" role="alert">
                {userNameError}
              </p>
            )}
            {userNameSaved && (
              <p className="subheading" role="status">
                Nome salvo.
              </p>
            )}
            <div className="settings-actions">
              <button
                type="submit"
                className="primary-button"
                disabled={userNameLoading || userNameSaving}
              >
                {userNameSaving ? "Salvando..." : "Salvar nome"}
              </button>
            </div>
          </form>
        </section>
        <section className="form-section" aria-labelledby="database-setting">
          <div className="form-section-heading">
            <div>
              <h2 id="database-setting">Banco de dados</h2>
              <p>Origem atual dos dados neste computador.</p>
            </div>
          </div>
          <div className="settings-body">
            {!available ? (
              <p className="subheading" role="status">
                Configurações de banco disponíveis somente no aplicativo
                desktop.
              </p>
            ) : (
              <>
                <label className="form-field">
                  <span>Caminho atual</span>
                  <input
                    type="text"
                    readOnly
                    value={path ?? ""}
                    placeholder={loading ? "" : "Caminho indisponível"}
                    title={path ?? undefined}
                    aria-describedby={pathDescription}
                    aria-invalid={error ? true : undefined}
                  />
                </label>
                {loading && (
                  <p
                    className="subheading"
                    id="database-path-status"
                    role="status"
                  >
                    Carregando caminho…
                  </p>
                )}
                {error && (
                  <p
                    className="form-error"
                    id="database-path-error"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
                <p className="subheading">
                  O aplicativo será reiniciado após a confirmação. O banco
                  anterior não será movido nem apagado.
                </p>
                <div className="settings-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={changeDatabase}
                    disabled={loading || !path}
                  >
                    Trocar banco de dados
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
        {available && (
          <section className="form-section" aria-labelledby="assets-setting">
            <div className="form-section-heading">
              <div>
                <h2 id="assets-setting">Imagens</h2>
                <p>Pasta onde os logos dos clientes são armazenados.</p>
              </div>
            </div>
            <div className="settings-body">
              <label className="form-field">
                <span>Pasta de imagens</span>
                <input
                  type="text"
                  readOnly
                  value={assetsPath ?? ""}
                  placeholder={assetsLoading ? "" : "Caminho indisponível"}
                  title={assetsPath ?? undefined}
                  aria-describedby={assetsPathDescription}
                  aria-invalid={assetsError ? true : undefined}
                />
              </label>
              {assetsLoading && (
                <p className="subheading" id="assets-path-status" role="status">
                  Carregando pasta de imagens…
                </p>
              )}
              {assetsError && (
                <p className="form-error" id="assets-path-error" role="alert">
                  {assetsError}
                </p>
              )}
              <p className="subheading">
                A pasta de imagens acompanha a pasta do banco de dados: ao mover
                o banco, os logos vão junto.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
