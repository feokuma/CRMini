"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

type UpdateAction = "check" | "download" | "install";

type UpdatesBridge = NonNullable<NonNullable<Window["crmDesktop"]>["updates"]>;

type ProgressStyle = CSSProperties & { "--update-progress": string };

type ChipAction = {
  label: string;
  shortLabel?: string;
  action?: UpdateAction;
};

/** O percentual já chega limitado pelo processo principal; normalize por segurança. */
function progressPercent(percent: number | undefined) {
  if (typeof percent !== "number" || !Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

/** Uma frase por transição de estado, anunciada pela região viva. */
function liveAnnouncement(snapshot: UpdateSnapshot) {
  switch (snapshot.status) {
    case "available":
      return snapshot.targetVersion
        ? `Atualização ${snapshot.targetVersion} disponível.`
        : "Atualização disponível.";
    case "downloading":
      return "Baixando atualização.";
    case "downloaded":
      return "Atualização pronta. Reinicie para aplicar.";
    case "installing":
      return "Reiniciando para atualizar.";
    default:
      return "";
  }
}

/** Retentativa da falha: `install` reaproveita o arquivo já baixado. */
function retryAction(snapshot: UpdateSnapshot): UpdateAction {
  const phase = snapshot.error?.phase;
  if (phase === "check") return "check";
  if (phase === "install" && snapshot.targetVersion) return "install";
  return "download";
}

function chipAction(snapshot: UpdateSnapshot): ChipAction | null {
  switch (snapshot.status) {
    case "available":
      return {
        label: snapshot.targetVersion
          ? `Atualizar para ${snapshot.targetVersion}`
          : "Atualizar",
        shortLabel: "Atualizar",
        action: "download",
      };
    case "downloaded":
      return {
        label: "Reiniciar para atualizar",
        shortLabel: "Reiniciar",
        action: "install",
      };
    case "installing":
      // Sem ação: o processo principal está reiniciando para aplicar a atualização.
      return {
        label: "Reiniciando para atualizar…",
        shortLabel: "Reiniciando…",
      };
    case "error":
      return {
        label: "Tentar novamente",
        action: retryAction(snapshot),
      };
    default:
      return null;
  }
}

/**
 * Chip global de atualização do aplicativo desktop. O estado canônico vem do
 * processo principal (`electron/updater.cjs`); este componente só reflete o
 * snapshot recebido por evento ou por `getState`.
 */
export default function UpdateChip() {
  const [updates, setUpdates] = useState<UpdatesBridge | null>(null);
  const [snapshot, setSnapshot] = useState<UpdateSnapshot | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const bridge = window.crmDesktop?.updates;
    // Navegador e `next dev` sem Electron: nenhum chip, nenhum erro.
    if (!bridge) return;

    let active = true;
    setUpdates(bridge);
    // Assina antes de pedir o estado para não perder transições entre as chamadas.
    const unsubscribe = bridge.onState((next) => {
      if (active) setSnapshot(next);
    });
    bridge
      .getState()
      .then((next) => {
        if (active) setSnapshot(next);
      })
      .catch(() => {
        // Sem estado canônico o chip não aparece; não inventamos mensagem aqui.
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function run(action: UpdateAction) {
    if (!updates) return;
    setPending(true);
    try {
      const result = await updates[action]();
      // O main é a fonte de verdade: só corrigimos o estado quando ele nega a ação.
      if (!result.ok) setSnapshot(result.snapshot);
    } catch {
      // Rejeição do IPC não cria mensagem; o estado continua o do processo principal.
    } finally {
      setPending(false);
    }
  }

  if (!updates || !snapshot) return null;
  if (!snapshot.enabled) return null;
  const { status } = snapshot;
  if (status === "idle" || status === "checking") return null;
  // Falha de verificação automática é silenciosa.
  if (status === "error" && !snapshot.error?.visible) return null;

  const action = chipAction(snapshot);
  const runAction = action?.action;
  const percent = progressPercent(snapshot.progress?.percent);
  const progressStyle: ProgressStyle = {
    "--update-progress": `${percent}%`,
  };

  return (
    <div className="update-chip" data-status={status}>
      <span
        className="update-chip-live"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveAnnouncement(snapshot)}
      </span>
      {status === "downloading" && (
        <>
          <span className="update-chip-text">
            Baixando atualização… {percent}%
          </span>
          <div
            className="update-chip-progress"
            role="progressbar"
            aria-label="Download da atualização"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <span style={progressStyle} />
          </div>
        </>
      )}
      {status === "error" && (
        <p className="update-chip-error" role="alert">
          Não foi possível atualizar.
        </p>
      )}
      {action && (
        <button
          type="button"
          className={`update-chip-action update-chip-action--${
            status === "error" ? "secondary" : "primary"
          }`}
          aria-label={action.label}
          disabled={!runAction || pending}
          onClick={runAction ? () => run(runAction) : undefined}
        >
          <span className="update-chip-label-long">{action.label}</span>
          {action.shortLabel && (
            <span className="update-chip-label-short">{action.shortLabel}</span>
          )}
        </button>
      )}
    </div>
  );
}
