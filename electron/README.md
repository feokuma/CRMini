# Desktop com Electron

Esta aplicação abre o CRM numa janela Electron. A interface e as APIs continuam sendo servidas pelo Next.js localmente; o Electron não transforma o Next em código nativo nem substitui o banco.

## Desenvolvimento

Execute o CRM em modo desktop com o servidor de desenvolvimento do Next.js:

```bash
npm run desktop:dev
```

O Electron inicia `next dev`; alterações no código são refletidas sem gerar um novo build. Encerre outras instâncias do CRM antes de iniciar.

## Executar a versão de produção

```bash
npm run desktop
```

`npm run desktop` executa `desktop:build` (`npm run build && npm run prepare:standalone`) e, em seguida, inicia o Electron servindo o build standalone de `.next/standalone/server.js`. O `desktop:build` sempre gera o build antes de abrir a janela.

O servidor standalone roda sob `ELECTRON_RUN_AS_NODE`. O `better-sqlite3` 13 usa prebuilds N-API (`prebuilds/<plataforma>-<arch>.node`), compatíveis com Node e Electron, então não é preciso reconstruir o módulo para cada runtime. O `npm run desktop` roda `npm run check:electron-abi` antes de abrir a janela e falha com uma mensagem explícita se o prebuild da plataforma não carregar.

Antes de iniciar o Next.js, o app aplica as migrations pendentes do banco escolhido em um processo Node separado (`electron/database-migrations.cjs` → `database/migrate.cjs`). Se a atualização falhar, a janela não abre: o app mostra o erro, informa o caminho do backup gerado e encerra sem alterar o restante do banco.

O servidor fica limitado a `127.0.0.1` em uma porta livre. Esta aplicação inicia e encerra o Next.js junto da janela. Na primeira inicialização, escolha o banco padrão (`app.getPath('userData')/crm.sqlite`), abrir banco existente ou criar/selecionar arquivo; a escolha é persistida em `userData/preferences.json`. A sidebar Configurações permite trocar o caminho e reinicia o app após confirmação do seletor nativo. O banco anterior nunca é movido ou apagado. Se o caminho persistido não estiver disponível ou for inválido, o app informa o problema e oferece seletor explícito de recuperação; cancelar encerra o app preservando a preferência e sem criar arquivo vazio. Para backup, encerre o app antes de copiar o arquivo, ou use a API SQLite de backup.

## Caminhos de recursos e dados

O servidor Next resolve seus diretórios por variáveis de ambiente injetadas pelo Electron:

- `CRM_RESOURCES_DIR`: raiz dos recursos somente leitura. `src/lib/db.ts` lê `init.sql` e `migrations/` em `<CRM_RESOURCES_DIR>/database`. No pacote, aponta para `resources/app`; em produção local, para `.next/standalone`; em dev, cai em `process.cwd()`.
- `CRM_DATA_DIR`: raiz dos dados graváveis do usuário (`app.getPath('userData')`). Os logos enviados são gravados e lidos em `<CRM_DATA_DIR>/tmp/assets`.

Sem essas variáveis (ex.: `npm run dev`), o comportamento é o atual: `process.cwd()` como base.

## Layout do standalone

Após `npm run prepare:standalone`, `.next/standalone` contém:

- `server.js` — entrypoint do Next standalone.
- `.next/static/` e `public/` — copiados pelo script (o Next não os rastreia via `fs`).
- `database/` — `init.sql`, `migrations/` e os `.cjs` usados pelo processo de migrations.
- `node_modules/better-sqlite3` — copiado pelo script para garantir o prebuild N-API da plataforma (o tracing do Next pode omiti-lo).

## Limitações / próximos passos

- O aplicativo empacotado para Windows (instalador NSIS + portable) ainda não está configurado. O empacotamento é o próximo passo, incluindo `electron-builder`, ícone e assinatura.
