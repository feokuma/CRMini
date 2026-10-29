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

it("segue o esqueleto de página e o card de formulário do padrão visual", () => {
  render(<SettingsPage />);

  expect(screen.getByRole("main")).toHaveClass("records-page");
  const breadcrumbs = screen.getByRole("navigation", {
    name: "Navegação estrutural",
  });
  expect(breadcrumbs).toHaveTextContent("Meu espaço");
  expect(breadcrumbs).toHaveTextContent("Configurações");
  expect(screen.getByText("PREFERÊNCIAS")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { level: 1, name: "Configurações" }),
  ).toBeInTheDocument();

  const section = screen
    .getByRole("heading", { name: "Banco de dados" })
    .closest("section");
  expect(section).toHaveClass("form-section");
  expect(section).toHaveAttribute("aria-labelledby", "database-setting");
});

it("mostra o caminho em campo somente leitura com ação primária", async () => {
  window.crmDesktop = {
    getDatabasePath: vi.fn().mockResolvedValue("/user/crm.sqlite"),
    getAssetsPath: vi.fn().mockResolvedValue("/user/assets"),
    chooseDatabase: vi.fn(),
  };

  render(<SettingsPage />);

  const pathField = await screen.findByDisplayValue("/user/crm.sqlite");
  expect(pathField).toHaveAttribute("readonly");
  expect(
    screen.getByRole("button", { name: /trocar banco de dados/i }),
  ).toHaveClass("primary-button");
});

it("mostra caminho desktop e informa falha no seletor", async () => {
  window.crmDesktop = {
    getDatabasePath: vi.fn().mockResolvedValue("/user/crm.sqlite"),
    getAssetsPath: vi.fn().mockResolvedValue("/user/assets"),
    chooseDatabase: vi
      .fn()
      .mockResolvedValue({ ok: false, error: "Banco inválido" }),
  };
  render(<SettingsPage />);
  await waitFor(() =>
    expect(screen.getByDisplayValue("/user/crm.sqlite")).toBeInTheDocument(),
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
    getAssetsPath: vi.fn().mockResolvedValue("/user/assets"),
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

  expect(
    screen.getByDisplayValue("/tmp/isolated/crm.sqlite"),
  ).toBeInTheDocument();
  expect(screen.queryByText("Carregando caminho…")).not.toBeInTheDocument();
});

it("para o carregamento e bloqueia troca quando falha consulta do caminho", async () => {
  window.crmDesktop = {
    getDatabasePath: vi.fn().mockRejectedValue(new Error("IPC indisponível")),
    getAssetsPath: vi.fn().mockResolvedValue("/user/assets"),
    chooseDatabase: vi.fn(),
  };

  render(<SettingsPage />);

  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível consultar o banco configurado.",
    ),
  );
  expect(screen.getByRole("button", { name: /trocar banco/i })).toBeDisabled();
  expect(screen.getByLabelText("Caminho atual")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

it("mostra erro se a promessa do seletor rejeitar", async () => {
  window.crmDesktop = {
    getDatabasePath: vi.fn().mockResolvedValue("/user/crm.sqlite"),
    getAssetsPath: vi.fn().mockResolvedValue("/user/assets"),
    chooseDatabase: vi.fn().mockRejectedValue(new Error("IPC indisponível")),
  };
  render(<SettingsPage />);
  await waitFor(() =>
    expect(screen.getByDisplayValue("/user/crm.sqlite")).toBeInTheDocument(),
  );
  screen.getByRole("button", { name: /trocar banco/i }).click();
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível abrir o seletor",
    ),
  );
});

it("não mostra erro quando o usuário cancela o seletor", async () => {
  const chooseDatabase = vi
    .fn()
    .mockResolvedValue({ ok: false, canceled: true });
  window.crmDesktop = {
    getDatabasePath: vi.fn().mockResolvedValue("/user/crm.sqlite"),
    getAssetsPath: vi.fn().mockResolvedValue("/user/assets"),
    chooseDatabase,
  };

  render(<SettingsPage />);
  await waitFor(() =>
    expect(screen.getByDisplayValue("/user/crm.sqlite")).toBeInTheDocument(),
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
    getAssetsPath: vi.fn().mockResolvedValue("/user/assets"),
    chooseDatabase,
  };

  render(<SettingsPage />);
  await waitFor(() =>
    expect(screen.getByDisplayValue("/user/crm.sqlite")).toBeInTheDocument(),
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
    getAssetsPath: vi.fn().mockResolvedValue("/user/assets"),
    chooseDatabase,
  };

  render(<SettingsPage />);
  await waitFor(() =>
    expect(screen.getByDisplayValue("/user/crm.sqlite")).toBeInTheDocument(),
  );

  screen.getByRole("button", { name: /trocar banco/i }).click();
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Banco inválido"),
  );

  screen.getByRole("button", { name: /trocar banco/i }).click();
  await waitFor(() => expect(chooseDatabase).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("exibe a pasta de imagens em campo somente leitura", async () => {
  window.crmDesktop = {
    getDatabasePath: vi.fn().mockResolvedValue("/user/crm.sqlite"),
    getAssetsPath: vi.fn().mockResolvedValue("/user/assets"),
    chooseDatabase: vi.fn(),
  };

  render(<SettingsPage />);

  const assetsField = await screen.findByDisplayValue("/user/assets");
  expect(assetsField).toHaveAttribute("readonly");
  expect(screen.getByLabelText("Pasta de imagens")).toBe(assetsField);

  const section = screen
    .getByRole("heading", { level: 2, name: "Imagens" })
    .closest("section");
  expect(section).toHaveClass("form-section");
  expect(section).toHaveAttribute("aria-labelledby", "assets-setting");
  expect(section?.querySelector("button")).toBeNull();
});

it("mostra caminho indisponível quando a pasta de imagens é nula", async () => {
  window.crmDesktop = {
    getDatabasePath: vi.fn().mockResolvedValue("/user/crm.sqlite"),
    getAssetsPath: vi.fn().mockResolvedValue(null),
    chooseDatabase: vi.fn(),
  };

  render(<SettingsPage />);

  const assetsField = screen.getByLabelText("Pasta de imagens");
  await waitFor(() =>
    expect(assetsField).toHaveAttribute("placeholder", "Caminho indisponível"),
  );
  expect(assetsField).toHaveValue("");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("mostra erro acessível quando a consulta da pasta de imagens falha", async () => {
  window.crmDesktop = {
    getDatabasePath: vi.fn().mockResolvedValue("/user/crm.sqlite"),
    getAssetsPath: vi.fn().mockRejectedValue(new Error("IPC indisponível")),
    chooseDatabase: vi.fn(),
  };

  render(<SettingsPage />);

  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível consultar a pasta de imagens.",
    ),
  );

  const assetsField = screen.getByLabelText("Pasta de imagens");
  expect(assetsField).toHaveAttribute("aria-invalid", "true");
  expect(assetsField).toHaveAttribute("aria-describedby", "assets-path-error");
  expect(
    screen.queryByText("Carregando pasta de imagens…"),
  ).not.toBeInTheDocument();
});

it("não mostra a seção de imagens no navegador", () => {
  render(<SettingsPage />);

  expect(
    screen.queryByRole("heading", { level: 2, name: "Imagens" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Pasta de imagens")).not.toBeInTheDocument();
});
