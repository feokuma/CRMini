# Reply CRM — CRM inicial

Aplicação Next.js para organizar empresas clientes e suas pessoas de contato. O cadastro é persistido em PostgreSQL.

## Começar

Requisitos: Node.js 20.9 ou superior e Docker com Compose.

```bash
npm install
npm run db:up
npm run dev
```

Copie `.env.example` para `.env.local` antes de iniciar. O schema `database/init.sql` é aplicado quando o volume do banco é criado pela primeira vez. Execute `npm run db:seed` para criar três empresas de exemplo e seus contatos. O seed pode ser executado novamente sem duplicar esses registros. Para apagar o banco e recriar as tabelas: `docker compose down -v` e `docker compose up -d`.

Abra [http://localhost:3000](http://localhost:3000). Para validar a produção, use `npm run build`.

Para bancos já inicializados, execute `database/migrations/001_opportunities.sql` uma única vez antes de usar a tela de oportunidades. Clientes não são excluídos pela aplicação: a ação disponível os desativa e preserva o histórico. A duração de projeto é persistida em horas (8 por dia, 40 por semana e 160 por mês). Para os testes unitários sem dependências externas, execute `node --test tests/*.test.mjs`.

Datas e horários seguem o padrão brasileiro (`dd/mm/aaaa` e `dd/mm/aaaa, hh:mm`) na interface, no fuso `America/Sao_Paulo`. Instantes (colunas `TIMESTAMPTZ`) são persistidos como UTC pelo PostgreSQL. Campos que representam somente uma data (colunas `DATE`, como aniversário e abertura) permanecem datas civis `aaaa-mm-dd` no banco: não representam um instante e não devem ser convertidos entre fusos, para evitar deslocamento de dia.

## Estrutura

- `src/app/page.tsx`: visão geral do CRM.
- `src/app/clientes`: lista, cadastro e edição de clientes e contatos.
- `src/app/api/clients`: endpoints de cadastro, consulta, edição e exclusão.
- `src/app/oportunidades`: cadastro e acompanhamento de oportunidades.
- `database/migrations/001_opportunities.sql`: migração manual para bancos existentes.
- `database/init.sql`: schema PostgreSQL.
- `database/seed.sql`: clientes e contatos de demonstração.
- `tmp/assets`: armazenamento provisório dos logos enviados (não versionado).
- `src/app/globals.css`: estilos responsivos da aplicação.
- `src/app/layout.tsx`: layout raiz e metadados.

Os contatos têm data de aniversário opcional e perfil do LinkedIn. Logos aceitam PNG, JPG ou WebP até 2 MB. `tmp/assets` é um armazenamento provisório, não adequado para implantação efêmera ou produção.
