import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const layoutSidebarPlacementPattern = /<AppSidebar\s*\/>\s*\{children\}/;
const accessibleNavigationPattern = /<nav aria-label="Navegação principal">/;
const pathnameHookPattern = /usePathname\(\)/;
const navigationDestinationPattern = /\[("[^"]+"),\s*"[^"]+",\s*"([^"]+)"\]/g;
const rootPathActivePattern = /pathname === "\/"/;
const nestedPathActivePattern = /pathname\.startsWith\(href\)/;
const activePageAttributePattern = /aria-current=\{active \? "page" : undefined\}/;
const fixedSidebarStylePattern = /\.sidebar\{position:sticky;top:0;height:100vh;min-height:0;overflow:hidden;/;
const compactSidebarMediaPattern = /@media\(max-width:680px\)\{\.sidebar\{width:62px/;
const hiddenCompactLabelPattern = /\.sidebar \.nav-item\{[^}]*font-size:0/;
const visibleCompactIconPattern = /\.sidebar \.nav-item>span\{font-size:18px/;

async function readProjectFile(file: string): Promise<string> {
  return readFile(
    new URL(file, import.meta.url),
    "utf8",
  );
}

describe("menu lateral", () => {
  it("é compartilhado no layout e usa navegação acessível", async () => {
    const layout = await readProjectFile("../src/app/layout.tsx");
    const sidebar = await readProjectFile("../src/components/app-sidebar.tsx");

    expect(layoutSidebarPlacementPattern.test(layout)).toBe(true);
    expect(accessibleNavigationPattern.test(sidebar)).toBe(true);
    expect(pathnameHookPattern.test(sidebar)).toBe(true);
  });

  it("contém os cinco destinos principais e indica a rota atual", async () => {
    const sidebar = await readProjectFile("../src/components/app-sidebar.tsx");
    const destinations = [...sidebar.matchAll(navigationDestinationPattern)]
      .map(([, href, label]) => [JSON.parse(href), label]);

    expect(destinations).toEqual([
      ["/", "Visão geral"],
      ["/clientes", "Clientes"],
      ["/contatos", "Contatos"],
      ["/oportunidades", "Oportunidades"],
      ["/tarefas", "Tarefas"],
    ]);
    expect(rootPathActivePattern.test(sidebar)).toBe(true);
    expect(nestedPathActivePattern.test(sidebar)).toBe(true);
    expect(activePageAttributePattern.test(sidebar)).toBe(true);
  });

  it("permanece fixo na tela sem criar uma área própria de rolagem", async () => {
    const css = await readProjectFile("../src/app/globals.css");

    expect(fixedSidebarStylePattern.test(css)).toBe(true);
  });

  it("exibe navegação compacta com rótulos acessíveis em telas estreitas", async () => {
    const css = await readProjectFile("../src/app/globals.css");
    const sidebar = await readProjectFile("../src/components/app-sidebar.tsx");

    expect(compactSidebarMediaPattern.test(css)).toBe(true);
    expect(hiddenCompactLabelPattern.test(css)).toBe(true);
    expect(visibleCompactIconPattern.test(css)).toBe(true);
    expect(sidebar).toContain("title={label}");
  });
});
