import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/image", () => ({ default: () => null }));

import ClientForm from "./client-form";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

function mockFetch(
  handler?: (url: string, init?: RequestInit) => Promise<Response> | Response,
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (handler) {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      return handler(url, init);
    }
    return jsonResponse({ id: "client-1" }, true, 201);
  });
}

function savedClient(overrides: Record<string, unknown> = {}) {
  return {
    id: "client-1",
    company_name: "Aurora Tecnologia",
    website: "example.com",
    contacts: [
      { id: "contact-1", full_name: "Ana Souza", is_primary: true },
    ],
    ...overrides,
  };
}

function siteField() {
  return screen.getByRole("textbox", { name: "Site" });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ClientForm — campo Site", () => {
  it.each(["example.com", "https://example.com", "http://example.com"])(
    "mantém %s como texto válido, sem validação de URL do navegador",
    (website) => {
      render(<ClientForm />);
      const site = siteField();

      fireEvent.change(site, { target: { value: website } });

      expect(site).toHaveValue(website);
      expect(site).toBeValid();
      expect(site).not.toHaveAttribute("type", "url");
    },
  );

  it("envia o site sem protocolo ao salvar um novo cliente", async () => {
    const fetchMock = mockFetch();
    render(<ClientForm />);

    fireEvent.change(screen.getByRole("textbox", { name: /Razão social/ }), {
      target: { value: "Aurora Tecnologia" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Nome completo/ }), {
      target: { value: "Ana Souza" },
    });
    fireEvent.change(siteField(), { target: { value: "example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar cliente" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/clients",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.website).toBe("example.com");
  });

  it("carrega site sem protocolo na edição e preserva o valor no PUT", async () => {
    const fetchMock = mockFetch((_url, init) =>
      init?.method === "PUT"
        ? jsonResponse({ id: "client-1" })
        : jsonResponse(savedClient()),
    );
    render(<ClientForm id="client-1" />);

    await waitFor(() => expect(siteField()).toHaveValue("example.com"));
    expect(siteField()).toBeValid();
    expect(siteField()).not.toHaveAttribute("type", "url");

    fireEvent.click(screen.getByRole("button", { name: "Salvar cliente" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/clients/client-1",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    const putCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
    )!;
    const body = JSON.parse((putCall[1] as RequestInit).body as string);
    expect(body.website).toBe("example.com");
  });

  it("aceita site vazio como campo opcional e o envia ao salvar", async () => {
    const fetchMock = mockFetch();
    render(<ClientForm />);
    const site = siteField();

    expect(site).toHaveValue("");
    expect(site).toBeValid();
    expect(site).not.toBeRequired();
    expect(site).not.toHaveAttribute("type", "url");

    fireEvent.change(screen.getByRole("textbox", { name: /Razão social/ }), {
      target: { value: "Aurora Tecnologia" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Nome completo/ }), {
      target: { value: "Ana Souza" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar cliente" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/clients",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.website).toBe("");
  });
});
