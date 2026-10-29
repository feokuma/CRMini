import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/" } }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

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

import AppSidebar from "./app-sidebar";

afterEach(() => {
  cleanup();
  delete window.crmDesktop;
});

describe("Menu lateral", () => {
  it("exibe a marca CRMini mantendo o ícone da marca", () => {
    render(<AppSidebar />);

    expect(screen.getByRole("link", { name: "CRMini" })).toBeInTheDocument();
    expect(screen.getByText("ini")).toBeInTheDocument();
    expect(screen.getByText("CRM")).toBeInTheDocument();
    expect(screen.getByAltText("CRMini")).toHaveAttribute(
      "src",
      expect.stringContaining("crmini-symbol.svg"),
    );
  });

  it("exibe somente os destinos principais da navegação", () => {
    pathname.current = "/";
    render(<AppSidebar />);

    const navigation = screen.getByRole("navigation", {
      name: "Navegação principal",
    });
    expect(navigation.querySelectorAll("a")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Visão geral" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Clientes" })).toHaveAttribute(
      "href",
      "/clientes",
    );
    expect(screen.getByRole("link", { name: "Contatos" })).toHaveAttribute(
      "href",
      "/contatos",
    );
    expect(screen.getByRole("link", { name: "Oportunidades" })).toHaveAttribute(
      "href",
      "/oportunidades",
    );
    expect(screen.getByRole("link", { name: "Tarefas" })).toHaveAttribute(
      "href",
      "/tarefas",
    );
  });

  it("indica a área atual em rotas internas sem ativar a visão geral", () => {
    pathname.current = "/oportunidades/nova";
    render(<AppSidebar />);

    expect(screen.getByRole("link", { name: "Oportunidades" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Visão geral" }),
    ).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Clientes" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("indica somente a visão geral como ativa na página inicial", () => {
    pathname.current = "/";
    render(<AppSidebar />);

    expect(screen.getByRole("link", { name: "Visão geral" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Tarefas" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("mantém rótulos acessíveis e descritivos nos links com ícones", () => {
    pathname.current = "/contatos";
    render(<AppSidebar />);

    const contactsLink = screen.getByRole("link", { name: "Contatos" });
    expect(contactsLink).toHaveAttribute("title", "Contatos");
    expect(contactsLink.querySelector("span")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("não exibe Configurações quando a ponte desktop não está disponível", () => {
    render(<AppSidebar />);

    expect(
      screen.queryByRole("link", { name: "Configurações" }),
    ).not.toBeInTheDocument();
  });

  it("exibe Configurações somente no desktop e marca a rota ativa", () => {
    pathname.current = "/configuracoes";
    window.crmDesktop = {
      getDatabasePath: vi.fn(),
      getAssetsPath: vi.fn(),
      chooseDatabase: vi.fn(),
    };

    render(<AppSidebar />);

    const settingsLink = screen.getByRole("link", { name: "Configurações" });
    expect(settingsLink).toHaveAttribute("href", "/configuracoes");
    expect(settingsLink).toHaveAttribute("aria-current", "page");
  });
});
