import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
import Breadcrumbs from "./breadcrumbs";
describe("Breadcrumbs", () => {
  it("renderiza trilha com links e página atual", () => {
    render(<Breadcrumbs items={[{ label: "Meu espaço", href: "/" }, { label: "Clientes", href: "/clientes" }, { label: "Novo cliente" }]} />);
    expect(screen.getByRole("navigation", { name: "Navegação estrutural" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clientes" })).toHaveAttribute("href", "/clientes");
    expect(screen.getByText("Novo cliente")).toHaveAttribute("aria-current", "page");
  });
});
