# Migrations manuais

O schema de bancos novos é `database/init.sql`, aplicado automaticamente na
abertura do banco SQLite local (ver `src/lib/db.ts`).

Para bancos já existentes, alterações de schema são migrations manuais nesta
pasta, nomeadas com prefixo numérico (`001_*.sql`, `002_*.sql`, ...). Aplique
cada uma uma única vez, em ordem, a bancos compatíveis, por exemplo:

```bash
sqlite3 database/crm.sqlite < database/migrations/001_exemplo.sql
```

Bancos existentes precisam aplicar `001_contacts_soft_delete.sql` antes de
usar a versão com soft delete de contatos.

Faça backup do arquivo `database/crm.sqlite` antes de migrations destrutivas.
As migrations da era PostgreSQL foram removidas na migração para SQLite; o
histórico delas permanece no Git.
