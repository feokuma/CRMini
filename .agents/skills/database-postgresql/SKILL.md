---
name: database-postgresql
description: Orienta alterações seguras no schema e nas consultas PostgreSQL do CRM.
---

# PostgreSQL do CRM

Use ao alterar `database/*.sql`, consultas ou acesso ao banco.

## Contexto atual

- O acesso à aplicação usa `pg` e um `Pool` em `src/lib/db.ts`.
- `database/init.sql` inicializa schema com `CREATE TABLE/INDEX IF NOT EXISTS`; `database/seed.sql` fornece dados de demonstração.
- Não há ferramenta formal de migrações indicada no `package.json`. Não trate `init.sql` como migração automática de uma base já existente.

## Orientações

- Leia schema, consultas e seeds relacionados antes de editar; preserve UUIDs, timestamps e a relação `contacts.client_id` com exclusão em cascata salvo requisito aprovado.
- Parametrize valores SQL. Identificadores SQL dinâmicos não podem vir diretamente de entrada do usuário.
- Avalie constraints, índices, valores nulos, compatibilidade de tipos e impacto em dados já existentes. Evite índices/constraints redundantes.
- Mudanças que exijam alterar uma base já criada precisam de passos de migração explícitos e seguros; não dependa de `IF NOT EXISTS` para modificar colunas existentes.
- Faça operações multi-etapa em transação e garanta rollback e liberação de conexão.
- Mantenha seed repetível quando possível; use dados fictícios, sem informações reais de clientes ou contatos.
- Não execute comandos destrutivos ou apague volumes/dados para validar alterações sem autorização explícita.

## Verificação

Confira o schema resultante, consultas afetadas e efeitos de exclusão/atualização. Valide seeds e testes sem destruir dados existentes; descreva passos necessários para bancos já inicializados.
