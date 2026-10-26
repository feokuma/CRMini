import { cleanup, render, screen } from "@testing-library/react";
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

afterEach(() => cleanup());

describe("Lista de contatos", () => {
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
