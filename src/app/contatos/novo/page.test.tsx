import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

import NewContactPage from "./page";

afterEach(() => cleanup());

describe("Página Novo contato", () => {
  it("renderiza o formulário de cadastro de contato", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    render(<NewContactPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Novo contato" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cadastrar contato" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/clients"));
  });
});
