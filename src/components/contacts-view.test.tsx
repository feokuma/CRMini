import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

import ContactsView from "./contacts-view";

function ok(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Lista de contatos", () => {
  it("exibe carregamento e não vazio enquanto a primeira resposta está pendente", async () => {
    let resolve!: (response: Response) => void;
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<ContactsView />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando contatos");
    expect(screen.queryByRole("heading", { name: "Nenhum contato encontrado" })).not.toBeInTheDocument();
    resolve({ ok: true, json: async () => [] } as Response);
    expect(await screen.findByRole("heading", { name: "Nenhum contato encontrado" })).toBeInTheDocument();
  });

  it("apresenta erro após falha ao carregar", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Falha ao carregar contatos."));
    render(<ContactsView />);
    expect(await screen.findByText("Falha ao carregar contatos.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Nenhum contato encontrado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("exibe os contatos retornados pela API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      ok([
        {
          id: "contact-1",
          full_name: "Pessoa Exemplo",
          job_title: "Analista",
          email: "pessoa@example.com",
          is_primary: true,
          client_id: "client-1",
          company_name: "Empresa Alfa",
          industry: "Tecnologia",
        },
      ]),
    );

    render(<ContactsView />);

    expect(await screen.findByText("Pessoa Exemplo")).toBeInTheDocument();
    expect(screen.getByText("1 contato(s)")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Nenhum contato encontrado" }),
    ).not.toBeInTheDocument();
  });

  it("carrega a primeira listagem imediatamente, sem debounce", () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(ok([]));

    render(<ContactsView />);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/contacts");
  });

  it("aplica debounce nas buscas subsequentes", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(ok([]));

    render(<ContactsView />);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Buscar contatos"), {
      target: { value: "alfa" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(199);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/contacts?q=alfa");
  });

  it("ignora a resposta de uma busca anterior quando uma nova busca já resolveu", async () => {
    vi.useFakeTimers();
    let resolveInitial!: (response: Response) => void;
    let resolveSearch!: (response: Response) => void;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolveInitial = done;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolveSearch = done;
          }),
      );

    render(<ContactsView />);
    fireEvent.change(screen.getByLabelText("Buscar contatos"), {
      target: { value: "beta" },
    });

    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/contacts?q=beta");

    resolveSearch(
      ok([
        {
          id: "contact-2",
          full_name: "Pessoa Beta",
          is_primary: false,
          client_id: "client-2",
          company_name: "Empresa Beta",
        },
      ]),
    );
    await flush();

    expect(screen.getByText("Pessoa Beta")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    resolveInitial(
      ok([
        {
          id: "contact-1",
          full_name: "Pessoa Alfa",
          is_primary: false,
          client_id: "client-1",
          company_name: "Empresa Alfa",
        },
      ]),
    );
    await flush();

    expect(screen.getByText("Pessoa Beta")).toBeInTheDocument();
    expect(screen.queryByText("Pessoa Alfa")).not.toBeInTheDocument();
    expect(screen.getByText("1 contato(s)")).toBeInTheDocument();
  });

  it("leva ao formulário de novo contato a partir do cabeçalho", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    render(<ContactsView />);

    expect(
      screen.getByRole("link", { name: "＋ Novo contato" }),
    ).toHaveAttribute("href", "/contatos/novo");
    expect(
      await screen.findByRole("heading", {
        name: "Nenhum contato encontrado",
      }),
    ).toBeInTheDocument();
  });
});
