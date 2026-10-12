# Reply CRM

Aplicação web de CRM para organizar empresas clientes, contatos, oportunidades e tarefas. Os dados são persistidos em PostgreSQL; a interface permite acompanhar informações e atividades comerciais em um só lugar.

## Tecnologias

- Next.js 15 e React 19
- TypeScript 5
- PostgreSQL 16, acessado pela biblioteca `pg`
- Docker Compose para executar o banco localmente
- ESLint 9 para análise estática
- Vitest + React Testing Library para testes automatizados de lógica e componentes React

## Requisitos

- Node.js 20.9 ou superior e npm
- Docker com Docker Compose

## Configuração e execução local

Na raiz do repositório, instale as dependências e configure a conexão com o banco:

```bash
npm install
cp .env.example .env.local
```

O `.env.example` já contém a URL adequada para o PostgreSQL local definido no Compose. Inicie o banco e a aplicação:

```bash
npm run db:up
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000). Para encerrar o banco, use `npm run db:down`.

## Banco de dados e migrations

O serviço PostgreSQL 16 do Docker Compose é publicado na porta `5432`. Na primeira inicialização de um volume, o Docker aplica automaticamente `database/init.sql`, que cria o schema. Para inserir os dados de demonstração (três empresas e seus contatos), execute:

```bash
npm run db:seed
```

O seed pode ser executado novamente sem duplicar esses registros.

As migrations não são executadas automaticamente. Em bancos já inicializados que ainda não possuem oportunidades e tarefas, aplique os arquivos na ordem abaixo, uma única vez cada, com o serviço `postgres` em execução:

```bash
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U reply_crm -d reply_crm -f - < database/migrations/001_opportunities.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U reply_crm -d reply_crm -f - < database/migrations/002_tasks.sql
```

Não execute migrations em bancos que já as receberam. Para descartar completamente o banco local e recriá-lo do zero, remova também o volume — isso apaga todos os dados:

```bash
docker compose down -v
npm run db:up
```

## Testes e validação

Execute os testes automatizados (não precisam de banco ou serviços externos) com Vitest:

```bash
npm test
```

Os testes ficam próximos aos módulos em `src/` ou na pasta `tests/`. `npm run test:components` também executa a suíte Vitest completa.

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
- `database/init.sql`: schema PostgreSQL para bancos novos.
- `database/migrations`: migrations manuais para bancos existentes.
- `database/seed.sql`: clientes e contatos de demonstração.
- `tmp/assets`: armazenamento provisório dos logos enviados (não versionado).
- `src/app/globals.css`: estilos responsivos da aplicação.
- `src/app/layout.tsx`: layout raiz e metadados.

Clientes não são excluídos pela aplicação: a ação disponível os desativa e preserva o histórico. A duração de projeto é persistida em horas (8 por dia, 40 por semana e 160 por mês). Datas e horários seguem o padrão brasileiro na interface e o fuso `America/Sao_Paulo`; instantes são armazenados em UTC, enquanto campos `DATE` permanecem datas civis sem conversão de fuso. Logos aceitam PNG, JPG ou WebP até 2 MB. `tmp/assets` é um armazenamento provisório, não adequado para implantação efêmera ou produção.
