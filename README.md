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

## Estrutura

- `src/app/page.tsx`: visão geral do CRM.
- `src/app/clientes`: lista, cadastro e edição de clientes e contatos.
- `src/app/api/clients`: endpoints de cadastro, consulta, edição e exclusão.
- `database/init.sql`: schema PostgreSQL.
- `database/seed.sql`: clientes e contatos de demonstração.
- `tmp/assets`: armazenamento provisório dos logos enviados (não versionado).
- `src/app/globals.css`: estilos responsivos da aplicação.
- `src/app/layout.tsx`: layout raiz e metadados.

Os contatos têm data de aniversário opcional e perfil do LinkedIn. Logos aceitam PNG, JPG ou WebP até 2 MB. `tmp/assets` é um armazenamento provisório, não adequado para implantação efêmera ou produção.
