# Plano: pasta de imagens (logos) acompanhando o diretório do banco

Status: aprovado em 2026-10-29 (decisões em §11).

## 1. Contexto e problema

Hoje o local dos logos é fixo e independente do banco escolhido pelo usuário:

| Item             | Como é resolvido hoje                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Banco (Electron) | escolhido em Configurações → `preferences.json` → `SQLITE_PATH` no processo filho (`electron/server-lifecycle.cjs:62`)                            |
| Banco (web/dev)  | `SQLITE_PATH` do ambiente ou `defaultDatabasePath()` (`database/sqlite-paths.cjs`)                                                                |
| Logos            | `path.join(process.env.CRM_DATA_DIR ?? process.cwd(), "tmp", "assets")` em `src/app/api/logo/route.ts:33` e `src/app/api/logo/[name]/route.ts:22` |
| `CRM_DATA_DIR`   | sempre `app.getPath("userData")` (`electron/main.cjs:14`, `electron/resource-paths.cjs`)                                                          |

Como `logo_path` é gravado no banco apenas como URL relativa (`/api/logo/<uuid>.<ext>`),
mover/copiar o `.sqlite` para outra pasta ou máquina faz os logos darem 404: os
arquivos continuam em `userData`. Banco e imagens só são transportáveis juntos se
a pasta de assets acompanhar o banco.

## 2. Decisão recomendada

**Derivar a pasta de assets do diretório do banco e propagá-la ao servidor Next como
`CRM_ASSETS_DIR`:**

```
<dirname(SQLITE_PATH)>/assets
```

Exemplos:

| Banco escolhido                                         | Pasta de imagens                           |
| ------------------------------------------------------- | ------------------------------------------ |
| `C:\Users\x\AppData\Roaming\CRMini\crm.sqlite` (padrão) | `C:\Users\x\AppData\Roaming\CRMini\assets` |
| `D:\CRM\crm.sqlite`                                     | `D:\CRM\assets`                            |
| `~/Documentos/cliente-x/banco.sqlite`                   | `~/Documentos/cliente-x/assets`            |
| web/dev sem nenhuma variável                            | `./tmp/assets` (inalterado)                |

Alternativas avaliadas:

| Alternativa                                         | Prós                                                                       | Contras                                                                          | Veredito                  |
| --------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------- |
| `<dir do banco>/assets`                             | acompanha o banco; um comando de cópia resolve backup; simples de explicar | dois bancos na mesma pasta compartilham a pasta (inofensivo, mas acumula órfãos) | **recomendada**           |
| `<dir do banco>/<nome-do-banco>.assets`             | isola banco a banco                                                        | quebra se o `.sqlite` for renomeado; pastas "estranhas" para o usuário           | descartada                |
| `userData/assets` (sem `tmp/`)                      | limpo                                                                      | não resolve o problema (continua não transportável)                              | descartada                |
| Escolher banco **e** pasta de imagens em todo fluxo | controle total                                                             | atrito em toda troca; mais diálogos e mais estados de erro                       | fase 2 opcional (ver §11) |

Decisões secundárias já tomadas na proposta:

- `CRM_DATA_DIR` continua existindo (preferências, `updater.json`, ícones), mas deixa
  de ser a fonte principal dos logos; permanece como **fallback de leitura** do
  diretório legado `<CRM_DATA_DIR>/tmp/assets`, sem prazo para remoção.
- `logo_path` no banco **não muda** (continua relativo). Nenhuma migration SQL.
- A migração dos logos antigos é **one-way e por movimento** (`rename`, com
  `copyFile` + `unlink` quando `rename` falhar com `EXDEV`, p.ex. entre discos),
  acontece uma única vez por instalação e é marcada em `preferences.json`. Arquivos
  que falharem permanecem no legado e continuam servidos pelo fallback de leitura.
- Sem escolha manual de pasta no v1: `assets/` é sempre derivada do banco e apenas
  exibida em Configurações.

## 3. Nova resolução de caminhos

Precedência (servidor Next):

```
leitura:  CRM_ASSETS_DIR  →  CRM_DATA_DIR/tmp/assets  →  process.cwd()/tmp/assets
escrita:  CRM_ASSETS_DIR  →  CRM_DATA_DIR/tmp/assets  →  process.cwd()/tmp/assets
```

O fallback de leitura só importa em bancos antigos cujos arquivos ainda não foram
movidos ou cujo movimento falhou; a escrita sempre usa o primeiro caminho disponível.

| Variável                    | Definida por                    | Uso                                    |
| --------------------------- | ------------------------------- | -------------------------------------- |
| `SQLITE_PATH`               | `electron/server-lifecycle.cjs` | banco em uso                           |
| `CRM_RESOURCES_DIR`         | idem                            | `init.sql` + `migrations/`             |
| `CRM_DATA_DIR`              | idem (`userData`)               | dados graváveis do app + logos legados |
| **`CRM_ASSETS_DIR`** (novo) | idem, derivado do banco         | logos atuais                           |

## 4. Contratos e arquivos afetados

### Novos

**`electron/assets-paths.cjs`** (CJS, coberto por `electron/**/*.cjs` no coverage —
por isso não fica em `database/`, que está fora do relatório):

```js
function defaultAssetsDir(databasePath)     // <dirname>/assets; undefined p/ ":memory:"
function legacyAssetsDir(dataDir)           // <dataDir>/tmp/assets
function assetsDirFor({ databasePath, dataDir })  // derivado (sem override no v1)
function ensureAssetsDir(dir)               // mkdir -p, tolerante
async function moveLegacyAssets({ legacyDir, destination, fs, logger })
  // por arquivo: rename → EXDEV: copyFile + unlink; não sobrescreve destino;
  // falha isolada → logger.warn e o arquivo permanece no legado
  // ao final, remove legacyDir se ficou vazia
  // retorna { moved, skipped, failed }
```

**`src/lib/logo-assets.ts`** (módulo único, coberto em `src/`):

```ts
type AssetDirs = { write: string; read: string[] };
function resolveAssetDirs(env = process.env): AssetDirs;
function isAllowedLogoName(name: string): boolean;
async function saveLogo(bytes: Uint8Array, extension: string): Promise<string>; // "/api/logo/<uuid>.<ext>"
async function readLogo(name: string): Promise<Buffer | null>; // null → 404
```

**`src/lib/logo-assets.test.ts`**, **`src/lib/electron-assets-paths.test.ts`**.

### Alterados

| Arquivo                               | Mudança                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `electron/main.cjs`                   | em `createWindow()` (linhas ~223-243), depois de `chooseDatabase()`: `const assetsDir = assetsDirFor({ databasePath, dataDir })`; se `preferences` ainda não marcou a migração, rodar `moveLegacyAssets()` e marcar; passar `assetsDir` para `server.start(databasePath, { assetsDir })`. Falha na migração só gera `console.warn` e **não** impede a janela de abrir.                                                                                 |
| `electron/server-lifecycle.cjs`       | `start(databasePath, { assetsDir, ... })`; no `childEnv` (linhas 57-67): `if (assetsDir !== undefined) childEnv.CRM_ASSETS_DIR = assetsDir;` ao lado de `CRM_DATA_DIR`.                                                                                                                                                                                                                                                                                |
| `electron/database-manager.cjs`       | `preferences.json` passa a ser lido/escrito como objeto: `readPreferences()`, `savePreferences(patch)` (leitura-modificação-escrita atômica como hoje, com `.tmp` + `renameSync`); `saveDatabasePath()` mantém a API e passa a preservar `legacyAssetsMigratedAt`; novos `markLegacyAssetsMigrated()` e `handleGetAssetsPath(event)` (deriva de `savedDatabasePath()` via `assets-paths.cjs`, atrás de `trustedSender`). `handleGetPath()` inalterado. |
| `electron/preload.cjs`                | novo `getAssetsPath: () => ipcRenderer.invoke("assets:get-path")`.                                                                                                                                                                                                                                                                                                                                                                                     |
| `electron/main.cjs` (IPC)             | `ipcMain.handle("assets:get-path", (event) => databaseManager.handleGetAssetsPath(event))`, atrás de `trustedSender`.                                                                                                                                                                                                                                                                                                                                  |
| `src/types/electron.d.ts`             | `crmDesktop.getAssetsPath(): Promise<string \| null>`.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/app/api/logo/route.ts`           | validação HTTP permanece (tipo, 2 MB, `File`); gravação delegada a `saveLogo()`; `try/catch` → 500 com mensagem de pasta indisponível.                                                                                                                                                                                                                                                                                                                 |
| `src/app/api/logo/[name]/route.ts`    | regex permanece; leitura delegada a `readLogo()` (tenta `write` e depois os fallbacks); `null` → 404.                                                                                                                                                                                                                                                                                                                                                  |
| `src/app/configuracoes/page.tsx`      | nova seção "Imagens" somente leitura exibindo `getAssetsPath()`, com os mesmos estados `loading`/`error`/`!available` já usados para o banco.                                                                                                                                                                                                                                                                                                          |
| `src/app/configuracoes/page.test.tsx` | casos novos (§7).                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/lib/db.ts`                       | sem mudança funcional; apenas confirmar que nada depende de `CRM_DATA_DIR` para assets.                                                                                                                                                                                                                                                                                                                                                                |

## 5. Fluxos

**Primeira abertura após a atualização (banco já configurado)**

1. `chooseDatabase()` devolve `databasePath`.
2. `assetsDir = <dirname>/assets`; `readPreferences().legacyAssetsMigratedAt` ausente.
3. `ensureAssetsDir(assetsDir)` + `moveLegacyAssets({ legacyDir: userData/tmp/assets, destination })` → move PNG/JPG/WebP que faltam; remove `tmp/assets` se ficar vazia.
4. `savePreferences({ legacyAssetsMigratedAt: new Date().toISOString() })` (marca mesmo com falhas parciais; os arquivos que falharam continuam no legado e o fallback de leitura os serve).
5. `server.start()` recebe `CRM_ASSETS_DIR`; banco e logos passam a viajar juntos.

**Troca de banco em Configurações**

`handleChoose()` inalterado (valida, salva `databasePath`, `app.relaunch()`). No
relaunch, a pasta derivada muda junto com o banco; a migração legada **não** roda de
novo (marca já gravada), evitando mover logos de um banco para a pasta de outro.

**Upload (`POST /api/logo`)**: valida tipo/tamanho → `mkdir(write)` → grava
`<uuid>.<ext>` → devolve `/api/logo/<uuid>.<ext>`. Erro de I/O (pendrive removido,
pasta somente leitura) → 500 com mensagem clara.

**Leitura (`GET /api/logo/[name]`)**: regex `^[\w-]+\.(png|jpg|webp)$` → tenta
`write` → tenta `CRM_DATA_DIR/tmp/assets` → 404 silencioso. UI já degrada sem
imagem (`clients-view.tsx:105`, `contacts-view.tsx:157`, `client-form.tsx:183`).

**Web/dev (`npm run dev`)**: sem `CRM_ASSETS_DIR`/`CRM_DATA_DIR`, tudo continua em
`./tmp/assets` (gitignored). Nada muda para quem não usa Electron.

## 6. Casos-limite e mensagens

| Caso                                                 | Comportamento                                                                                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Dois bancos na mesma pasta                           | compartilham `assets/`; nomes são UUID, sem colisão; órfãos só ocupam espaço                                                       |
| Banco em pendrive removido durante o uso             | POST → 500 "Não foi possível salvar a imagem. Verifique se a pasta do banco está disponível e gravável."; GET → 404; app não trava |
| Pasta do banco somente leitura                       | mesma mensagem do item anterior                                                                                                    |
| `SQLITE_PATH=:memory:`                               | `defaultAssetsDir()` → `undefined`; servidor cai no fallback (dev/test)                                                            |
| `CRM_ASSETS_DIR` igual ao legado                     | `moveLegacyAssets` sai imediatamente (`moved: 0`)                                                                                  |
| Arquivo já existente no destino                      | não sobrescreve (`skipped`) e não mexe na origem                                                                                   |
| Falha parcial no movimento                           | `console.warn` por arquivo; o arquivo fica no legado; abertura prossegue; fallback de leitura serve a imagem                       |
| Logos em `userData/tmp/assets` após a migração       | `tmp/assets` vazia é removida; arquivos com erro permanecem e continuam servidos                                                   |
| Banco antigo com `logo_path` de imagem nunca migrada | 404 na imagem, resto da UI intacta                                                                                                 |
| Usuário apaga a pasta `assets` depois                | imagens novas voltam a ser gravadas; as antigas ficam 404 (não há recuperação automática)                                          |
| Banco movido junto com `assets/`                     | funciona sem nenhuma ação extra (objetivo do plano)                                                                                |

## 7. Plano de testes

| Arquivo                                        | Casos                                                                                                                                                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/logo-assets.test.ts` (novo)           | precedência `CRM_ASSETS_DIR` > `CRM_DATA_DIR` > `cwd`; `read` inclui fallbacks na ordem; `write` tem um só caminho; `saveLogo` cria diretório e gera nome; `readLogo` devolve `null` para nome inválido/ausente; hash de caminho não permite traversal |
| `src/app/api/logo/route.test.ts`               | adaptar stubs para `CRM_ASSETS_DIR`; manter 200/400 (sem arquivo, tipo, 2 MB); novo caso: leitura cai no legado quando o arquivo só existe em `CRM_DATA_DIR/tmp/assets`; novo caso: `writeFile` falhando → 500 com mensagem                            |
| `src/lib/electron-assets-paths.test.ts` (novo) | derivação `<dirname>/assets`; `:memory:` → `undefined`; `ensureAssetsDir` tolerante; `moveLegacyAssets` move/skipa/não sobrescreve/falha parcial (fs injetado)/`EXDEV` cai em copy+unlink/idempotente/remove legado vazio                              |
| `src/lib/electron-server-lifecycle.test.ts`    | `CRM_ASSETS_DIR` presente quando `assetsDir` é passado; ausente quando `undefined`; não sobrescreve `SQLITE_PATH`                                                                                                                                      |
| `src/lib/electron-database-manager.test.ts`    | `saveDatabasePath` preserva `legacyAssetsMigratedAt`; `markLegacyAssetsMigrated()`; `handleGetAssetsPath` deriva do banco salvo e rejeita origem não confiável                                                                                         |
| `src/lib/electron-preload.test.ts`             | `getAssetsPath` exposto e encaminhado ao IPC correto                                                                                                                                                                                                   |
| `src/app/configuracoes/page.test.tsx`          | exibe pasta de imagens; estado de erro; esconde no navegador (`!available`)                                                                                                                                                                            |

Cobertura: os dois módulos novos entram em `coverage.include` sem exclusões; os
pisos atuais (`statements 80`, `branches 82`, `functions 72`, `lines 81`) devem ser
mantidos ou elevados. Validação final: `npm test`, `npm run coverage`, `npm run lint`,
`npm run build`.

## 8. Riscos e pontos de atenção

1. **Órfãos**: apagar um banco não remove as imagens dele. Aceitável; documentar. Uma
   limpeza por "logos não referenciados" fica fora de escopo (exigiria varrer todas as
   tabelas com `logo_path`).
2. **Movimento é irreversível**: o arquivo sai de `userData/tmp/assets` e passa a
   viver na pasta do banco. Se depois o usuário trocar de banco, os logos ficam na
   pasta do banco antigo (comportamento desejado, mas precisa estar claro na UI/docs).
   Se a cópia entre discos (`EXDEV`) falhar no `unlink`, o arquivo fica duplicado —
   inofensivo.
3. **Migração única**: se o usuário apagar a pasta nova depois da migração, as imagens
   somem; não há como recriá-las (o legado já foi esvaziado). Recomendar backup.
4. **Desempenho em rede/pendrive**: `assets/` ao lado do banco herda a latência do
   suporte; logos são pequenos (≤ 2 MB), impacto baixo.
5. **Backup**: copiar só o `.sqlite` deixa de ser suficiente — passa a ser
   `<pasta>/crm.sqlite*` + `<pasta>/assets/`. Precisa entrar nas instruções de backup
   (`README.md`, `electron/README.md`).
6. **`CRM_DATA_DIR` deixa de ser fonte dos logos** mas continua no contrato como
   fallback de leitura permanente; só sai se um dia houver decisão explícita.
7. **Nada de migration SQL**: `logo_path` permanece igual, então bancos antigos abrem
   normalmente.

## 9. Sequência de implementação

| #   | Etapa                 | Agente                              | Conteúdo                                                                                                                      |
| --- | --------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Derivação e env       | `@developer`                        | `electron/assets-paths.cjs`, `server-lifecycle.cjs`, `main.cjs`; testes `electron-assets-paths` e `electron-server-lifecycle` |
| 2   | Resolução no servidor | `@developer`                        | `src/lib/logo-assets.ts` + refatorar as duas rotas de logo; testes do módulo e das rotas                                      |
| 3   | Migração legada       | `@developer`                        | `preferences` como objeto em `database-manager.cjs` + chamada em `main.cjs`; testes `electron-database-manager`               |
| 4   | Exposição na UI       | `@developer`                        | `preload.cjs`, `electron/main.cjs` (IPC), `electron.d.ts`, `configuracoes/page.tsx`; testes preload + página                  |
| 5   | Fechamento            | `@test-engineer` / `@code-reviewer` | rodar `npm test`, `coverage`, `lint`, `build`; revisão de diff                                                                |
| 6   | Docs                  | `@writer`                           | `README.md`, `electron/README.md`, `docs/empacotamento-windows.md`, `.env.example`                                            |

Commits sugeridos (Gitmoji): `✨ feat(electron): derivar pasta de logos do banco`,
`✨ feat(api): resolver CRM_ASSETS_DIR com fallback legado`,
`✨ feat(electron): mover logos legados para a pasta do banco`,
`✨ feat(configuracoes): exibir pasta de imagens`,
`📝 docs: documentar pasta de imagens junto ao banco`.

## 10. Documentação a atualizar

- `README.md`: seção de estrutura (hoje cita `tmp/assets` como "armazenamento
  provisório") e instruções de backup — banco + `assets/`.
- `electron/README.md`: tabela de variáveis (`CRM_ASSETS_DIR`), regra de derivação e
  migração única do legado.
- `docs/empacotamento-windows.md`: tabela de caminhos (§6.1), Fase 0 (§10) e item
  "Local dos logos" (§11) — `%APPDATA%\CRMini\assets` junto ao banco padrão.
- `.env.example`: comentário opcional sobre `CRM_ASSETS_DIR` para uso web.

## 11. Decisões aprovadas (2026-10-29)

1. **Nome da pasta**: `assets/` ao lado do banco.
2. **Escolha manual**: não no v1 — apenas exibir o caminho derivado em Configurações;
   override manual fica registrado como fase 2 futura.
3. **Migração**: **mover** os logos em `userData/tmp/assets` para a pasta do banco
   (com `EXDEV` → copiar + remover), uma única vez, mantendo no legado apenas o que
   falhar.
4. **Fallback de leitura do legado**: manter indefinidamente.
