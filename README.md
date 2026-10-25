# Reply CRM

Aplicação web de CRM para organizar empresas clientes, contatos, oportunidades e tarefas. Os dados são persistidos em um arquivo SQLite local; a interface permite acompanhar informações e atividades comerciais em um só lugar.

## Tecnologias

- Next.js 15 e React 19
- TypeScript 5
- SQLite 3, acessado pela biblioteca `better-sqlite3` (arquivo local, sem servidor)
- ESLint 9 para análise estática
- Vitest + React Testing Library para testes automatizados de lógica e componentes React

## Requisitos

- Node.js 20.9 ou superior e npm

## Configuração e execução local

Na raiz do repositório, instale as dependências:

```bash
npm install
```

Opcionalmente copie `.env.example` para `.env.local` para definir `SQLITE_PATH`, o caminho do arquivo do banco (padrão: `./database/crm.sqlite`).

Inicie a aplicação:

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000). Na primeira conexão, o arquivo do banco é criado e o schema de `database/init.sql` é aplicado automaticamente, sem etapa manual.

## Banco de dados e migrations

O banco é um arquivo SQLite local (padrão `database/crm.sqlite`, configurável por `SQLITE_PATH`). O schema é criado automaticamente na primeira conexão a partir de `database/init.sql`, de forma idempotente; as chaves estrangeiras são habilitadas em cada conexão (`PRAGMA foreign_keys = ON`).

Para inserir os dados de demonstração (três empresas, seus contatos e oportunidades de exemplo), execute:

```bash
npm run db:seed
```

O seed pode ser executado novamente sem duplicar esses registros.

Alterações de schema para bancos já existentes são migrations manuais em `database/migrations`, aplicadas em ordem numérica, uma única vez cada; veja `database/migrations/README.md`. Faça backup do arquivo do banco antes de migrations destrutivas. Para descartar completamente o banco local e recriá-lo do zero, apague o arquivo `database/crm.sqlite` — isso apaga todos os dados.

### Convenções de dados

- IDs são UUIDs em texto gerados pela aplicação.
- Booleanos são `INTEGER` 0/1 no banco e `true`/`false` nas respostas das APIs.
- Valores monetários e horas de projeto são `TEXT` com decimal canônico (ex.: `"1234.56"`), preservando a precisão decimal; somas do painel usam aritmética de centavos inteiros.
- Datas civis (aniversário, abertura de oportunidade) são `TEXT` no formato `YYYY-MM-DD`, sem conversão de fuso.
- Instantes (`created_at`, `updated_at`, `scheduled_at`) são `TEXT` ISO-8601 em UTC (`YYYY-MM-DDTHH:MM:SS.sssZ`), apresentados na interface no fuso `America/Sao_Paulo`.
- A busca textual usa `LIKE` do SQLite, que ignora maiúsculas/minúsculas apenas para caracteres ASCII.

## Testes e validação

Execute os testes automatizados (não precisam de serviços externos) com Vitest:

```bash
npm test
```

Os testes ficam próximos aos módulos em `src/` ou na pasta `tests/`. `npm run test:components` também executa a suíte Vitest completa. Os testes de repositório usam um banco SQLite em memória, isolado do banco local.

Para verificar o lint e gerar a versão de produção:

```bash
npm run lint
npm run build
```

Depois do build, a versão de produção pode ser iniciada com `npm run start`.

## Estrutura

- `src/app/page.tsx`: visão geral do CRM.
- `src/app/clientes`: lista, cadastro e edição de clientes e contatos.
- `src/app/api/clients`: endpoints de cadastro, consulta, edição e exclusão.
- `src/app/oportunidades`: cadastro e acompanhamento de oportunidades.
- `src/app/tarefas`: tarefas.
- `src/lib/db.ts`: conexão SQLite única, com schema inicial e foreign keys habilitadas.
- `database/init.sql`: schema SQLite para bancos novos.
- `database/migrations`: migrations manuais para bancos existentes.
- `database/seed.sql` e `database/seed.mjs`: clientes, contatos e oportunidades de demonstração.
- `tmp/assets`: armazenamento provisório dos logos enviados (não versionado).
- `src/app/globals.css`: estilos responsivos da aplicação.
- `src/app/layout.tsx`: layout raiz e metadados.

Clientes não são excluídos pela aplicação: a ação disponível os desativa e preserva o histórico. A duração de projeto é persistida em horas (8 por dia, 40 por semana e 160 por mês). Datas e horários seguem o padrão brasileiro na interface e o fuso `America/Sao_Paulo`; instantes são armazenados em UTC, enquanto campos de data civil permanecem sem conversão de fuso. Logos aceitam PNG, JPG ou WebP até 2 MB. `tmp/assets` é um armazenamento provisório, não adequado para implantação efêmera ou produção.
