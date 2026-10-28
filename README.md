# CRMini

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

Opcionalmente copie `.env.example` para `.env.local` para definir `SQLITE_PATH`. Sem override, o banco fica em `$XDG_DATA_HOME/crminho/crm.sqlite` ou `~/.local/share/crminho/crm.sqlite` no Linux.

Inicie a aplicação:

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000). Na primeira conexão, o arquivo do banco é criado e o schema de `database/init.sql` é aplicado automaticamente, sem etapa manual.

## Executar no Electron

Para desenvolver na janela desktop, use:

```bash
npm run desktop:dev
```

Esse comando inicia o Electron com `next dev`. Alterações no código do Next.js são atualizadas automaticamente, sem executar `npm run build`. Encerre outras instâncias do CRM antes de iniciar.

Para executar a versão de produção dentro do Electron:

```bash
npm run desktop
```

O comando `npm run desktop` executa `desktop:build` (equivalente a `npm run build && npm run prepare:standalone`) e, em seguida, inicia o Electron servindo o build standalone (`.next/standalone/server.js`). Ele sempre gera o build antes de abrir a janela. Alterações no código do Electron exigem reiniciar o aplicativo. Veja também [electron/README.md](./electron/README.md).

O servidor standalone roda sob `ELECTRON_RUN_AS_NODE`. O `better-sqlite3` 13 usa prebuilds N-API (`prebuilds/<plataforma>-<arch>.node`), compatíveis com Node e Electron, então não é preciso reconstruir o módulo para cada runtime. O comando `npm run desktop` executa `npm run check:electron-abi` antes de abrir a janela e falha com uma mensagem explícita se o prebuild da plataforma não carregar.

## Banco de dados e migrations

O banco é um arquivo SQLite local no diretório de dados do usuário (configurável por `SQLITE_PATH`). Na abertura, as migrations pendentes de `database/migrations` são executadas automaticamente em ordem e, em seguida, o schema de `database/init.sql` é reaplicado de forma idempotente (em banco novo, o `init.sql` cria tudo e as migrations históricas entram apenas no registro). No Electron, a escolha do banco ocorre apenas na primeira inicialização e fica salva nas preferências do usuário; as migrations rodam antes de iniciar o Next.js, e uma falha impede a abertura da janela. Use Configurações para escolher outro banco; o app reinicia para abrir o novo caminho, sem mover ou apagar o anterior. Se o caminho salvo não estiver disponível ou for inválido, o app informa o problema e oferece seletor explícito de recuperação; cancelar encerra o app preservando a preferência e sem criar banco vazio.

Para inserir os dados de demonstração (três empresas, seus contatos e oportunidades de exemplo), execute:

```bash
npm run db:seed
```

O seed pode ser executado novamente sem duplicar esses registros.

Alterações de schema para bancos já existentes são migrations append-only em `database/migrations`, aplicadas automaticamente em ordem numérica na abertura do banco e também por `npm run db:migrate` (com caminho opcional: `npm run db:migrate -- /tmp/banco.sqlite`). Antes de aplicar migrations pendentes, o runner cria uma cópia de segurança `<caminho-do-banco>.bak-<AAAAMMDDhhmmss>`; bancos criados por uma versão mais nova do CRM, com migrations desconhecidas, são recusados sem alteração. Veja `database/migrations/README.md`. Para descartar completamente o banco local e recriá-lo do zero, apague o arquivo `database/crm.sqlite` — isso apaga todos os dados.

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
- `src/lib/db.ts`: conexão SQLite única, com schema inicial, migrations e foreign keys habilitadas.
- `database/init.sql`: schema SQLite para bancos novos.
- `database/migrate.cjs`: runner que aplica o schema, registra/aplica migrations e gera backup antes de alterar bancos existentes.
- `database/migrations`: migrations SQL append-only para bancos existentes.
- `database/seed.sql` e `database/seed.mjs`: clientes, contatos e oportunidades de demonstração.
- `tmp/assets`: armazenamento provisório dos logos enviados (não versionado).
- `src/app/globals.css`: estilos responsivos da aplicação.
- `docs/padrao-visual.md`: padrão visual obrigatório para criação e ajuste de telas.
- `src/app/layout.tsx`: layout raiz e metadados.

Clientes não são excluídos pela aplicação: a ação disponível os desativa e preserva o histórico. A duração de projeto é persistida em horas (8 por dia, 40 por semana e 160 por mês). Datas e horários seguem o padrão brasileiro na interface e o fuso `America/Sao_Paulo`; instantes são armazenados em UTC, enquanto campos de data civil permanecem sem conversão de fuso. Logos aceitam PNG, JPG ou WebP até 2 MB. `tmp/assets` é um armazenamento provisório, não adequado para implantação efêmera ou produção.
