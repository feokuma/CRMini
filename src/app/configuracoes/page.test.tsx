import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import SettingsPage from "./page";

afterEach(() => {
  cleanup();
  delete window.crmDesktop;
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

it("mostra estado indisponível no navegador sem oferecer ação de troca", () => {
  render(<SettingsPage />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "somente no aplicativo desktop",
  );
  expect(
    screen.queryByRole("button", { name: /trocar banco/i }),
  ).not.toBeInTheDocument();
});

it("mostra caminho desktop e informa falha no seletor", async () => {
  window.crmDesktop = {
    getDatabasePath: vi.fn().mockResolvedValue("/user/crm.sqlite"),
    chooseDatabase: vi.fn().mockResolvedValue({ ok: false, error: "Banco inválido" }),
  };
  render(<SettingsPage />);
  await waitFor(() =>
    expect(screen.getByText("/user/crm.sqlite")).toBeInTheDocument(),
  );
  screen.getByRole("button", { name: /trocar banco/i }).click();
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Banco inválido"),
  );
});

it("exibe o caminho somente depois que a ponte responde", async () => {
  const pathResponse = deferred<string | null>();
  window.crmDesktop = {
    getDatabasePath: vi.fn(() => pathResponse.promise),
    chooseDatabase: vi.fn(),
  };

  render(<SettingsPage />);

  expect(
    screen.getByRole("heading", { name: "Banco de dados" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Carregando caminho…")).toBeInTheDocument();

  await act(async () => {
    pathResponse.resolve("/tmp/isolated/crm.sqlite");
  });

  expect(screen.getByText("/tmp/isolated/crm.sqlite")).toBeInTheDocument();
  expect(screen.queryByText("Carregando caminho…")).not.toBeInTheDocument();
});

it("para o carregamento e bloqueia troca quando falha consulta do caminho", async () => {
  window.crmDesktop = {
    getDatabasePath: vi.fn().mockRejectedValue(new Error("IPC indisponível")),
    chooseDatabase: vi.fn(),
  };

  render(<SettingsPage />);

  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível consultar o banco configurado.",
    ),
  );
  expect(
    screen.getByRole("button", { name: /trocar banco/i }),
  ).toBeDisabled();
});

it("mostra erro se a promessa do seletor rejeitar", async () => {
  window.crmDesktop = {
    getDatabasePath: vi.fn().mockResolvedValue("/user/crm.sqlite"),
    chooseDatabase: vi.fn().mockRejectedValue(new Error("IPC indisponível")),
  };
  render(<SettingsPage />);
  await waitFor(() => expect(screen.getByText("/user/crm.sqlite")).toBeInTheDocument());
  screen.getByRole("button", { name: /trocar banco/i }).click();
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível abrir o seletor"));
});

it("não mostra erro quando o usuário cancela o seletor", async () => {
  const chooseDatabase = vi
    .fn()
    .mockResolvedValue({ ok: false, canceled: true });
  window.crmDesktop = {
    getDatabasePath: vi.fn().mockResolvedValue("/user/crm.sqlite"),
    chooseDatabase,
  };

  render(<SettingsPage />);
  await waitFor(() =>
    expect(screen.getByText("/user/crm.sqlite")).toBeInTheDocument(),
  );
  screen.getByRole("button", { name: /trocar banco/i }).click();

  await waitFor(() => expect(chooseDatabase).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("não mostra erro quando a troca é aceita e o aplicativo vai reiniciar", async () => {
  const chooseDatabase = vi
    .fn()
    .mockResolvedValue({ ok: true, restarting: true });
  window.crmDesktop = {
    getDatabasePath: vi.fn().mockResolvedValue("/user/crm.sqlite"),
    chooseDatabase,
  };

  render(<SettingsPage />);
  await waitFor(() =>
    expect(screen.getByText("/user/crm.sqlite")).toBeInTheDocument(),
  );
  screen.getByRole("button", { name: /trocar banco/i }).click();

  await waitFor(() => expect(chooseDatabase).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("limpa o erro anterior ao tentar trocar novamente", async () => {
  const chooseDatabase = vi
    .fn()
    .mockResolvedValueOnce({ ok: false, error: "Banco inválido" })
    .mockResolvedValueOnce({ ok: false, canceled: true });
  window.crmDesktop = {
    getDatabasePath: vi.fn().mockResolvedValue("/user/crm.sqlite"),
    chooseDatabase,
  };

  render(<SettingsPage />);
  await waitFor(() =>
    expect(screen.getByText("/user/crm.sqlite")).toBeInTheDocument(),
  );

  screen.getByRole("button", { name: /trocar banco/i }).click();
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Banco inválido"),
  );

  screen.getByRole("button", { name: /trocar banco/i }).click();
  await waitFor(() => expect(chooseDatabase).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
