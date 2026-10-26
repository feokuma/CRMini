import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import ContactForm from "./contact-form";

const assign = vi.fn();

const clients = [
  { id: "client-1", company_name: "Aurora Tecnologia", is_active: true },
  { id: "client-2", company_name: "Empresa Inativa", is_active: false },
];

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

function mockFetch(
  handler?: (url: string, init?: RequestInit) => Promise<Response> | Response,
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (handler) return handler(url, init);
    if (url === "/api/clients") return jsonResponse(clients);
    return jsonResponse({ id: "contact-1" }, true, 201);
  });
}

function submitButton() {
  return screen.getByRole("button", { name: /Cadastrar contato|Salvando/ });
}

function fillRequiredFields() {
  fireEvent.change(screen.getByRole("textbox", { name: /Nome completo/ }), {
    target: { value: "Ana Souza" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: /Cliente/ }), {
    target: { value: "client-1" },
  });
}

beforeEach(() => {
  assign.mockReset();
  vi.stubGlobal("location", { assign });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Novo contato", () => {
  it("renderiza os campos do contato e a navegação de retorno", async () => {
    const fetchMock = mockFetch();
    const { container } = render(<ContactForm />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Novo contato" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Dados do contato" })
        .parentElement,
    ).toHaveClass("form-section");

    const name = screen.getByRole("textbox", { name: /Nome completo/ });
    expect(name).toBeRequired();
    expect(name).toHaveAttribute("maxlength", "200");

    const client = screen.getByRole("combobox", { name: /Cliente/ });
    expect(client).toBeRequired();

    const notes = screen.getByRole("textbox", { name: /Observações/ });
    expect(notes.tagName).toBe("TEXTAREA");
    expect(notes).toHaveAttribute("maxlength", "5000");

    expect(
      screen.getByRole("checkbox", { name: "Contato principal" }),
    ).toHaveAttribute("value", "true");
    expect(screen.getByRole("button", { name: "Cadastrar contato" })).toHaveAttribute(
      "type",
      "submit",
    );

    expect(
      screen.getByRole("link", { name: /Voltar aos contatos/ }),
    ).toHaveAttribute("href", "/contatos");
    const breadcrumbs = screen.getByRole("navigation", {
      name: "Navegação estrutural",
    });
    expect(within(breadcrumbs).getByRole("link", { name: "Contatos" })).toHaveAttribute(
      "href",
      "/contatos",
    );
    expect(breadcrumbs).toHaveTextContent("Novo contato");

    // Estrutura esperada pelos seletores CSS do formulário.
    const form = container.querySelector("form.client-form")!;
    expect(form).not.toBeNull();
    expect(screen.getByRole("button")).toBe(form.querySelector(":scope > button.primary-button"));
    expect(notes.closest(".form-field")?.parentElement).toHaveClass("form-grid");
    expect(
      screen.getByRole("checkbox").closest(".contact-primary-checkbox"),
    ).not.toBeNull();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/clients"));
  });

  it("carrega no seletor apenas clientes ativos", async () => {
    mockFetch();
    render(<ContactForm />);

    const active = await screen.findByRole("option", {
      name: "Aurora Tecnologia",
    });
    expect(active).toHaveValue("client-1");
    expect(screen.queryByRole("option", { name: "Empresa Inativa" })).toBeNull();

    const placeholder = screen.getByRole("option", { name: "Selecione" });
    expect(placeholder).toHaveValue("");
    expect(placeholder).toBeDisabled();
  });

  it("avisa quando não consegue carregar os clientes", async () => {
    mockFetch(() => Promise.reject(new Error("offline")));
    render(<ContactForm />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os clientes.",
    );
  });

  it("envia os dados, mostra o estado de salvamento e navega após o sucesso", async () => {
    let resolveSubmit!: (response: Response) => void;
    const fetchMock = mockFetch((url) => {
      if (url === "/api/clients") return jsonResponse(clients);
      return new Promise<Response>((resolve) => {
        resolveSubmit = resolve;
      });
    });
    render(<ContactForm />);
    await screen.findByRole("option", { name: "Aurora Tecnologia" });

    fireEvent.change(screen.getByRole("textbox", { name: /Nome completo/ }), {
      target: { value: "Ana Souza" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /Cliente/ }), {
      target: { value: "client-1" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Observações/ }), {
      target: { value: "Prefere contato por e-mail" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Contato principal" }));
    fireEvent.click(submitButton());

    expect(screen.getByRole("button", { name: "Salvando…" })).toBeDisabled();
    const postCall = fetchMock.mock.calls.find(
      ([url]) => url === "/api/contacts",
    )!;
    const init = postCall[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toMatchObject({
      full_name: "Ana Souza",
      client_id: "client-1",
      notes: "Prefere contato por e-mail",
      is_primary: "true",
    });

    resolveSubmit(jsonResponse({ id: "contact-1" }, true, 201));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/contatos"));
    expect(assign).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cadastrar contato" })).toBeEnabled();
  });

  it("exibe a mensagem da API e permanece no formulário em caso de erro", async () => {
    mockFetch((url) =>
      url === "/api/clients"
        ? jsonResponse(clients)
        : jsonResponse({ error: "Cliente não encontrado ou inativo." }, false, 404),
    );
    render(<ContactForm />);
    await screen.findByRole("option", { name: "Aurora Tecnologia" });
    fillRequiredFields();

    fireEvent.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cliente não encontrado ou inativo.",
    );
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cadastrar contato" })).toBeEnabled();
  });

  it("usa uma mensagem padrão quando a API não informa o erro", async () => {
    mockFetch((url) =>
      url === "/api/clients"
        ? jsonResponse(clients)
        : jsonResponse({}, false, 500),
    );
    render(<ContactForm />);
    await screen.findByRole("option", { name: "Aurora Tecnologia" });
    fillRequiredFields();

    fireEvent.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível cadastrar o contato.",
    );
    expect(assign).not.toHaveBeenCalled();
  });
});
