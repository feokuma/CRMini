# Migrations

O schema de `database/init.sql` e as migrations desta pasta são aplicados
automaticamente na abertura do banco:

- pela aplicação Next.js, em `src/lib/db.ts`;
- pelo Electron, em um processo Node separado antes de iniciar o Next.js
  (ver `electron/database-migrations.cjs`);
- manualmente por `npm run db:migrate`, com caminho opcional:
  `npm run db:migrate -- /tmp/banco.sqlite`. A CLI respeita `SQLITE_PATH` e
  `.env.local` e, sem argumento, usa o caminho padrão de
  `database/sqlite-paths.cjs`.

## Formato e regras

Cada migration é um arquivo `.sql` com nome
`NNN_nome_em_snake_case.sql` (três dígitos, por exemplo
`001_contacts_soft_delete.sql`). Arquivos fora desse padrão, como este
`README.md`, são ignorados; versões duplicadas impedem a execução com erro.

- **Append-only:** nunca edite uma migration já publicada. Crie a próxima
  versão (`002_...`) para corrigir ou complementar o schema.
- **Mantenha `init.sql` e a migration em sincronia:** `init.sql` é o schema de
  um banco novo e precisa refletir o resultado final das migrations. Ao criar
  uma migration, atualize o `init.sql` de forma idempotente (`IF NOT EXISTS`,
  coluna já presente na definição da tabela etc.).
- Cada migration é executada uma única vez, em ordem numérica, dentro de uma
  transação. Se o SQL falhar, aquela migration sofre rollback e a versão não é
  registrada; o erro é propagado e interrompe a abertura da aplicação.
- **Ordem em banco existente:** as migrations pendentes rodam primeiro e o
  `init.sql` (idempotente) é aplicado depois. Assim um índice ou constraint do
  schema atual pode referenciar colunas criadas pela migration.
- **Não use `BEGIN`/`COMMIT`/`ROLLBACK` nem `PRAGMA`** dentro de uma migration:
  o runner já controla a transação e comandos de transação aninhados falham.
  Use apenas DDL/DML simples.

## Marcador `-- @applied-if`

Bancos antigos podem já conter a alteração sem ter o registro da migration
(aplicada manualmente, por exemplo). A primeira linha da migration pode declarar
um SELECT de verificação:

```sql
-- @applied-if: SELECT 1 FROM pragma_table_info('contacts') WHERE name = 'is_active'
```

O marcador só é reconhecido na primeira linha do arquivo e a consulta precisa
começar com `SELECT` ou `WITH` (somente leitura). Se o SELECT retornar uma
linha, considera-se que a migration já está refletida no banco e o runner
apenas registra a versão, sem executar o DDL. Sem o marcador, a migration sempre
executa quando não há registro. O `;` final do SELECT é opcional e removido pelo
runner. Erros de SQL na verificação citam a versão e o arquivo da migration.

## Marcador `-- @applied-if`

Bancos antigos podem já conter a alteração sem ter o registro da migration
(aplicada manualmente, por exemplo). A primeira linha da migration pode declarar
um SELECT de verificação:

```sql
-- @applied-if: SELECT 1 FROM pragma_table_info('contacts') WHERE name = 'is_active'
```

Se o SELECT retornar uma linha, considera-se que a migration já está refletida
no banco e o runner apenas registra a versão, sem executar o DDL. Sem o
marcador, a migration sempre executa quando não há registro. O `;` final do
SELECT é opcional e removido pelo runner.

Em um banco novo, o `init.sql` já aplica o schema completo. As migrations
históricas não são executadas: todas são registradas como baseline, e o SELECT
de cada `-- @applied-if` precisa retornar uma linha; caso contrário o runner
falha indicando que `init.sql` está desatualizado em relação àquela migration.

## Registro, backup e proteção

As versões aplicadas ficam na tabela `schema_migrations`
(`version`, `name`, `applied_at`), criada pelo runner e também declarada em
`init.sql`.

Antes de aplicar migrations pendentes em um banco existente, o runner executa
`wal_checkpoint(TRUNCATE)` e copia o arquivo para
`<caminho-do-banco>.bak-<AAAAMMDDhhmmss>` (com sufixo `-2`, `-3`, ... se o
caminho já existir). O backup é criado **antes** de qualquer alteração,
inclusive da tabela `schema_migrations`; se outro processo estiver usando o
banco e o checkpoint não puder ser concluído, a migração é abortada com erro em
vez de gerar um backup possivelmente inconsistente. Bancos em memória
(`:memory:`, usado em testes) não geram backup.

Se `schema_migrations` tiver uma versão que não existe nesta pasta, o banco foi
criado por uma versão mais nova do CRM. O runner recusa a operação com uma
mensagem clara e não altera nada, evitando downgrade acidental.
