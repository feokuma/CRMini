---
name: crm-list-ui-style
description: Mantém as telas de listagem do CRM consistentes com a listagem de contatos.
---

# Padrão visual para listagens do CRM

Ao criar ou ajustar telas de listagem, use `src/components/contacts-view.tsx` como referência visual e funcional.

## Estrutura

- Use `main.records-page` com `records-header`: eyebrow em caixa alta, título, subtítulo curto e ação principal alinhada à direita.
- Organize busca e filtros em uma barra compacta branca (`contact-filters`), com contagem de resultados (`contact-count`).
- Apresente registros em linhas/cards (`contact-list`, `contact-row`), não em tabela larga por padrão. Use colunas responsivas, hierarquia tipográfica compacta e divisores discretos.
- Use `empty-state` para ausência de resultados e `form-error` para falhas, mantendo mensagens visíveis.
- Preserve navegação por teclado, rótulos acessíveis e comportamento móvel.

## Aparência

- Reutilize as variáveis e classes de `src/app/globals.css`: fundo `#fafbf9`, superfícies brancas, bordas suaves, cantos arredondados, texto secundário cinza e verde `--accent` para ação/ênfase.
- Use `DM Sans` no conteúdo e mantenha o padrão compacto: metadados pequenos, títulos de registro em aproximadamente 12px, espaçamento uniforme e avatares/ícones discretos.
- Não introduza paleta, sombras, botões, filtros ou padrões de tabela independentes quando classes existentes forem adequadas.
- Em larguras menores, reordene informações em vez de permitir overflow horizontal; siga breakpoints e adaptações existentes para contatos (`900px` e `600px`).

## Verificação

- Compare visual e estruturalmente a listagem alterada com `ContactsView`.
- Verifique filtros, contagem, estado vazio, erro, foco visível e layout em tela estreita.
- Execute lint, build e testes disponíveis.
