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

function mockFetch() {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(jsonResponse({ id: "client-1" }, true, 201));
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
});
