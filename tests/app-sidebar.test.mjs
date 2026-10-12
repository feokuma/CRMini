import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(file, import.meta.url), "utf8");

test("o layout exibe o menu lateral compartilhado em todas as telas", async () => {
  const layout = await read("../src/app/layout.tsx");
  const sidebar = await read("../src/components/app-sidebar.tsx");

  assert.match(layout, /<AppSidebar\s*\/>\s*\{children\}/);
  assert.match(sidebar, /<nav aria-label="Navegação principal">/);
  assert.match(sidebar, /usePathname\(\)/);
});

test("o menu lateral contém apenas os cinco destinos principais e indica a rota atual", async () => {
  const sidebar = await read("../src/components/app-sidebar.tsx");
  const destinations = [...sidebar.matchAll(/\[("[^"]+"),\s*"[^"]+",\s*"([^"]+)"\]/g)]
    .map(([, href, label]) => [JSON.parse(href), label]);

  assert.deepEqual(destinations, [
    ["/", "Visão geral"],
    ["/clientes", "Clientes"],
    ["/contatos", "Contatos"],
    ["/oportunidades", "Oportunidades"],
    ["/tarefas", "Tarefas"],
  ]);
  assert.match(sidebar, /pathname === "\/"/);
  assert.match(sidebar, /pathname\.startsWith\(href\)/);
  assert.match(sidebar, /aria-current=\{active \? "page" : undefined\}/);
});

test("o menu lateral permanece fixo na tela e não cria uma área própria de rolagem", async () => {
  const css = await read("../src/app/globals.css");
  const sidebarRule = css.match(/\.sidebar\{position:sticky;top:0;height:100vh;min-height:0;overflow:hidden;/);

  assert.ok(sidebarRule, "sidebar must stay sticky, viewport-height, and hide overflow");
});

test("telas estreitas exibem navegação compacta com rótulos acessíveis", async () => {
  const css = await read("../src/app/globals.css");
  const sidebar = await read("../src/components/app-sidebar.tsx");

  assert.match(css, /@media\(max-width:680px\)\{\.sidebar\{width:62px/);
  assert.match(css, /\.sidebar \.nav-item\{[^}]*font-size:0/);
  assert.match(css, /\.sidebar \.nav-item>span\{font-size:18px/);
  assert.match(sidebar, /title=\{label\}/);
});
