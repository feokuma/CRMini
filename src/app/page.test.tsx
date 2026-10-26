import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => {
    throw new Error("Banco indisponível no teste");
  },
}));

import Home from "./page";

afterEach(() => cleanup());

describe("Visão geral", () => {
  it("leva ao formulário de cadastro ao selecionar Novo contato", async () => {
    render(await Home());

    expect(
      screen.getByRole("link", { name: "＋ Novo contato" }),
    ).toHaveAttribute("href", "/contatos/novo");
  });
});
