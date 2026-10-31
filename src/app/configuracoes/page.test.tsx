import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SettingsPage from "./page";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse({ userName: null }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  delete window.crmDesktop;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(
  body: unknown,
  ok = true,
  status = ok ? 200 : 500,
): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function desktopBridge() {
  return {
    getDatabasePath: vi.fn().mockResolvedValue("/user/crm.sqlite"),
    getAssetsPath: vi.fn().mockResolvedValue("/user/assets"),
    chooseDatabase: vi.fn(),
  };
}

async function waitForNameLoaded() {
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Salvar nome" })).toBeEnabled(),
  );
}

it("mostra estado indisponível no navegador sem oferecer ação de troca", () => {
  render(<SettingsPage />);
  expect(
    screen.getByText(/somente no aplicativo desktop/i),
  ).toBeInTheDocument();
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

it("mantém a seção Nome do usuário visível no navegador", () => {
  render(<SettingsPage />);

  expect(
    screen.getByRole("heading", { level: 2, name: "Nome do usuário" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Seu nome")).toHaveAttribute("maxlength", "80");
  expect(
    screen.queryByRole("button", { name: /trocar banco/i }),
  ).not.toBeInTheDocument();
});

it("preenche o campo com o nome retornado pela API", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ userName: "Ana" }));

  render(<SettingsPage />);

  expect(await screen.findByDisplayValue("Ana")).toBeInTheDocument();
  expect(screen.getByLabelText("Seu nome")).toHaveValue("Ana");
});

it("mostra carregamento do nome e desabilita salvar enquanto a consulta está pendente", async () => {
  const pending = deferred<Response>();
  fetchMock.mockReturnValueOnce(pending.promise);

  render(<SettingsPage />);

  expect(screen.getByText("Carregando nome…")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Salvar nome" })).toBeDisabled();

  await act(async () => {
    pending.resolve(jsonResponse({ userName: null }));
  });
  await waitFor(() =>
    expect(screen.queryByText("Carregando nome…")).not.toBeInTheDocument(),
  );
});

it("salva o nome digitado, confirma e reflete o valor normalizado da API", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse({ userName: "" }))
    .mockResolvedValueOnce(jsonResponse({ userName: "Maria Clara" }));

  render(<SettingsPage />);
  await waitForNameLoaded();

  const input = screen.getByLabelText("Seu nome");
  fireEvent.change(input, { target: { value: "  Maria   Clara " } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));

  expect(await screen.findByText("Nome salvo.")).toBeInTheDocument();
  expect(input).toHaveValue("Maria Clara");
  expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: "  Maria   Clara " }),
  });
});

it("mostra erro da API ao salvar e preserva o texto digitado", async () => {
  const apiError = "O nome do usuário deve ter no máximo 80 caracteres.";
  fetchMock
    .mockResolvedValueOnce(jsonResponse({ userName: "" }))
    .mockResolvedValueOnce(jsonResponse({ error: apiError }, false, 400));

  render(<SettingsPage />);
  await waitForNameLoaded();

  const input = screen.getByLabelText("Seu nome");
  fireEvent.change(input, { target: { value: "Nome digitado" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(apiError);
  expect(input).toHaveValue("Nome digitado");
});

it("mostra fallback acessível quando a rede falha ao salvar", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse({ userName: "" }))
    .mockRejectedValueOnce(new Error("rede indisponível"));

  render(<SettingsPage />);
  await waitForNameLoaded();

  const input = screen.getByLabelText("Seu nome");
  fireEvent.change(input, { target: { value: "Ana" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível salvar as configurações.",
  );
  expect(input).toHaveValue("Ana");
});

it("mostra erro acessível quando o nome atual não carrega e mantém o campo editável", async () => {
  fetchMock.mockRejectedValueOnce(new Error("rede indisponível"));

  render(<SettingsPage />);

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível carregar o nome do usuário.",
  );
  expect(screen.getByLabelText("Seu nome")).toBeEnabled();
});

it("envia userName vazio ao salvar o campo em branco", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse({ userName: "Ana" }))
    .mockResolvedValueOnce(jsonResponse({ userName: null }));

  render(<SettingsPage />);
  await screen.findByDisplayValue("Ana");

  const input = screen.getByLabelText("Seu nome");
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: "" }),
  });
});

it("mostra o caminho em campo somente leitura com ação primária", async () => {
  window.crmDesktop = desktopBridge();

  render(<SettingsPage />);

  const pathField = await screen.findByDisplayValue("/user/crm.sqlite");
  expect(pathField).toHaveAttribute("readonly");
  expect(
    screen.getByRole("button", { name: /trocar banco de dados/i }),
  ).toHaveClass("primary-button");
});

it("mostra caminho desktop e informa falha no seletor", async () => {
  window.crmDesktop = {
    ...desktopBridge(),
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
    ...desktopBridge(),
    getDatabasePath: vi.fn(() => pathResponse.promise),
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
    ...desktopBridge(),
    getDatabasePath: vi.fn().mockRejectedValue(new Error("IPC indisponível")),
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
    ...desktopBridge(),
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
    ...desktopBridge(),
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
    ...desktopBridge(),
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
    ...desktopBridge(),
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
  window.crmDesktop = desktopBridge();

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
    ...desktopBridge(),
    getAssetsPath: vi.fn().mockResolvedValue(null),
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
    ...desktopBridge(),
    getAssetsPath: vi.fn().mockRejectedValue(new Error("IPC indisponível")),
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
