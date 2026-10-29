# Plano técnico: empacotar o CRMini como aplicativo Windows (Electron + Next.js)

> Documento de arquitetura. Não implementa código de produção: descreve o desenho-alvo,
> as mudanças por arquivo (com trechos ilustrativos), a configuração de empacotamento,
> a estratégia de build/CI, os riscos, a estratégia de testes e o faseamento.
> Nada aqui altera o banco de dados nem instala dependências.

> Nota: a atualização automática (`electron-updater` + `latest.yml`) foi implementada depois
> deste plano e está documentada em [electron/README.md](../electron/README.md).

---

## 1. Objetivo e escopo

Distribuir o CRMini como aplicativo de desktop Windows empacotado no estilo VS Code:
um _shell_ Electron que hospeda o servidor Next.js empacotado em **standalone**, com o banco
SQLite local preservado no diretório de dados do usuário, entregue por um instalador por
plataforma (NSIS + portable).

**Dentro do escopo**

- Empacotar o Next.js em `output: "standalone"` e executá-lo dentro do Electron.
- Mover dados graváveis (banco, logos, preferências) para diretórios de escrita do usuário
  (`%APPDATA%`/`userData`), mantendo os recursos somente leitura (`database/init.sql`,
  `database/migrations/`) empacotados e fora do `asar` quando necessário.
- Empacotar com **electron-builder**, targets `nsis` + `portable`, instalação **per-user**
  sem exigir administrador.
- Garantir o prebuild **N-API** do `better-sqlite3` no pacote (`asarUnpack` dos `.node` e cópia
  no standalone), sem reconstrução por ABI.
- Build/CI em `windows-latest` com artefatos publicados.

**Fora do escopo (explícito, para aprovar depois)**

- Assinatura de código (certificado) e mitigação de SmartScreen.
- Atualização automática (`electron-updater` + servidor de releases).
- Suporte a macOS/Linux empacotado (a arquitetura de caminhos já isola plataforma, mas o
  empacotamento é específico de Windows nesta etapa).
- Migração do backend para SQL remoto; o CRM continua **100% local** (SQLite por arquivo).
- Mudança de regras de negócio. Este plano não altera comportamento de domínio.

---

## 2. Contexto atual (validado no código)

Pontos confirmados por inspeção; correções ao contexto previamente levantado aparecem marcadas.

1. **`package.json`** (linhas 5–18): scripts atuais `dev`, `build`, `start`, `desktop`,
   `desktop:dev`, `lint`, `test`, `db:seed`, `db:migrate`. Dependências: `better-sqlite3`
   `^13.0.3`, `next` `^15.3.0`; `electron` `^44.7.0` em devDependencies. **Não há**
   electron-builder/forge, não há CI, não há ícone nem assinatura.

2. **`electron/server-lifecycle.cjs`** (linhas 25–31): `start()` reserva uma **porta livre**
   (`reservePort()`, linha 26) e faz spawn de `process.execPath` com
   `ELECTRON_RUN_AS_NODE=1` executando `node_modules/next/dist/bin/next` com `cwd: projectDir`
   e `SQLITE_PATH` no env. **Correção ao contexto:** a porta é dinâmica hoje (não fixa em
   3174). O `3174` que aparece no `README.md`, em `electron/README.md` e em
   `electron/database-manager.cjs` (linhas 5–6) é apenas um _fallback_ de
   `getServerUrl`/documentação; o `main.cjs` sempre injeta `server.url` real. Isso é uma
   **vantagem** para o empacotamento (evita conflito de porta) e deve ser preservado.

3. **`electron/main.cjs`** (linhas 11–15, 32–67): sem _single instance lock_, sem
   `app.setAppUserModelId`, sem ícone, sem controle de navegação externa
   (`setWindowOpenHandler`/`will-navigate`). `contextIsolation: true` e
   `nodeIntegration: false` já estão corretos (linhas 58–59).

4. **`src/lib/db.ts`** (linhas 7–14): `databaseDir = path.join(process.cwd(), "database")`;
   carrega `sqlite-paths.cjs` e `migrate.cjs` por `require` relativo; lê `init.sql` e
   `migrations/` em tempo de execução (via `fs`). Em `Program Files`, `cwd` é somente leitura
   e imprevisível → precisa de diretório de recursos explícito.

5. **`src/app/api/logo/route.ts`** (linha 7) e **`src/app/api/logo/[name]/route.ts`**
   (linha 21): gravam/leem em `process.cwd()/tmp/assets`. Mesmo problema de `cwd`.

6. **`database/sqlite-paths.cjs`**: `defaultDatabasePath` já aceita `userData` e já cobre
   `win32`/`darwin`/`linux` (linhas 7–34); `validateDatabase`, `migrateLegacyDatabase`,
   `selectDatabasePath`, `shouldMigrateLegacy`. `better-sqlite3` é `require`d aqui (linha 3) —
   logo é carregado no **processo principal** via `electron/database-manager.cjs` → este
   arquivo.

7. **`database/migrate.cjs`**: runner completo; a CLI (`require.main === module`, linha 325)
   lê `.env.local` e `SQLITE_PATH`; o `__dirname` resolve `migrations/` e `init.sql` por
   caminho relativo. No app empacotado, a versão usada deve ser a **rastreada pelo
   standalone**, não a da CLI manual.

8. **`electron/database-migrations.cjs`** (linhas 9–10): `migrateScript` default aponta para
   `path.resolve(__dirname, "../database/migrate.cjs")` e `cwd` para o repositório — ambos
   inválidos quando empacotado.

9. **`next.config.ts`** (linhas 3–6): só define `distDir` (`.next-dev` em dev, `.next` em
   prod). Não há `output: "standalone"`.

10. **`electron/next-command.cjs`**: helper `getNextCommand` que **não é mais usado** pelo
    `server-lifecycle.cjs` (que monta o comando inline); só é exercitado por
    `src/lib/electron-next-command.test.ts`. Candidato a remoção ou reaproveitamento.

11. **Migrations existentes**: apenas `database/migrations/001_contacts_soft_delete.sql`
    (mais `README.md`, ignorado pelo runner). Não inventar quantidade — consultar a pasta.

12. **`.gitignore`**: já ignora `.next/`, `.next-dev/`, `node_modules/`, `tmp/assets/*`,
    `database/*.sqlite*`. Será preciso adicionar `dist/` (saída do electron-builder) e o
    diretório `build/` se ele contiver apenas artefatos gerados.

13. **Pré-renderização**: `.next/prerender-manifest.json` marca `/` (e as demais telas) com
    `initialRevalidateSeconds: false`. `src/app/page.tsx` lê o banco durante a renderização
    (com `try/catch`), enquanto as listagens são client components (`*-view.tsx`) que buscam
    via API. Em `next dev` a página é dinâmica; no build ela é congelada — divergência que o
    empacotamento torna permanente (ver §8).

---

## 3. Arquitetura alvo

### 3.1 Layout do aplicativo instalado

Instalação per-user (NSIS `oneClick`), base em `%LOCALAPPDATA%\Programs\CRMini`:

```
<installdir>/
├── CRMini.exe                 # binário do Electron (renomeado)
├── resources/
│   ├── app.asar               # shell Electron (main.cjs, preload, electron/*.cjs,
│   │                          #   database/sqlite-paths.cjs, node_modules prod — p/ processo principal)
│   ├── app.asar.unpacked/
│   │   └── node_modules/better-sqlite3/build/Release/better_sqlite3.node   # asarUnpack
│   ├── app/                   # Next.js standalone (extraResources, FORA do asar)
│   │   ├── server.js          # entrypoint do standalone
│   │   ├── node_modules/      # dependências rastreadas (inclui better-sqlite3 p/ Electron ABI)
│   │   ├── .next/
│   │   │   ├── static/        # copiada pelo script prepare
│   │   │   └── server/        # chunks compilados do Next
│   │   ├── public/            # copiada pelo script prepare
│   │   └── database/          # init.sql + migrations/ (copiados) + *.cjs rastreados
│   └── icon.ico               # ícone do app (extraResources)
└── (uninstall, etc.)
```

Dados do usuário (graváveis, sobrevivem a reinstalação):

```
%APPDATA%\CRMini\               # app.getPath("userData"), do productName na raiz
├── preferences.json            # databasePath escolhido (já existe hoje)
├── crm.sqlite (default)        # banco padrão, ou caminho escolhido pelo usuário
├── crm.sqlite.bak-*            # backups de migration
└── assets\                     # logos enviados, ao lado do banco em uso
```

O nome da pasta vem de `app.getName()`, que vale `CRMini` por causa do `productName` na raiz do
`package.json` e do `app.setName("CRMini")` no `main.cjs`. Como nenhuma versão publicada usou
outro nome, não existe migração de pasta: instalações novas já nascem em `CRMini`.

### 3.2 Fluxo de inicialização (empacotado)

1. `main.cjs`: _single instance lock_ + `app.setAppUserModelId` + ícone.
2. `databaseManager.chooseDatabase()` → escolhe/valida o banco (comportamento atual,
   preservado), salvo em `userData/preferences.json`.
3. `applyMigrations()` → spawna `process.execPath` (ELECTRON_RUN_AS_NODE) executando
   **`resources/app/database/migrate.cjs`** com `cwd: resources/app` (resolve
   `better-sqlite3` do standalone). Migrations leem `init.sql`/`migrations/` de
   `resources/app/database` (somente leitura) e escrevem só no banco + backup em `userData`.
4. `server.start(databasePath)` → reserva porta livre, spawna `process.execPath`
   (ELECTRON_RUN_AS_NODE) executando **`resources/app/server.js`** com env
   `HOSTNAME=127.0.0.1`, `PORT=<livre>`, `SQLITE_PATH=<db>`,
   `CRM_RESOURCES_DIR=resources/app`, `CRM_DATA_DIR=userData`,
   `CRM_ASSETS_DIR=<pasta do banco>/assets`.
5. O `server.js` (standalone) serve o Next; `db.ts` e as rotas de logo resolvem seus
   diretórios via `CRM_RESOURCES_DIR`/`CRM_ASSETS_DIR` (com `CRM_DATA_DIR` apenas como
   fallback de leitura dos logos legados).
6. `BrowserWindow` carrega `http://127.0.0.1:<porta>` com navegação externa restrita.

---

## 4. Decisão de runtime: `ELECTRON_RUN_AS_NODE` vs. `node.exe` embutido

| Critério                 | **A. `ELECTRON_RUN_AS_NODE` + `process.execPath`** (recomendado)                                                                    | **B. `node.exe` dedicado embutido**                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| ABI do `better-sqlite3`  | Sem problema de ABI: a versão 13 usa prebuilds **N-API** por plataforma/arquitetura, que carregam tanto no Node quanto no Electron. | Também sem problema de ABI, mas com dois runtimes para manter.                           |
| Complexidade             | Reaproveita o padrão **já existente** em `server-lifecycle.cjs` e `database-migrations.cjs`. Mudança mínima.                        | Novo runtime, nova rota de resolução de módulos, novo binário para empacotar/assinatura. |
| Tamanho                  | Sem custo adicional (reusa o Node já embutido no Electron).                                                                         | +~30–50 MB e +um binário a assinar/verificar.                                            |
| Simplicidade operacional | Um só "Node" para depurar.                                                                                                          | Duas versões de Node podem divergir (ex.: flags, bugfixes).                              |
| Riscos                   | Um só runtime, mas o binário `.node` precisa existir no pacote para a plataforma alvo (ver §7).                                     | Menos acoplamento ao Electron, mas ao custo de dupla manutenção.                         |

**Recomendação: opção A.** O projeto já spawna o Next com `ELECTRON_RUN_AS_NODE` hoje; usar o
mesmo mecanismo para o `server.js` standalone mantém um único runtime e a menor superfície de
mudança. O `better-sqlite3` 13 carrega prebuilds **N-API** (`prebuilds/<plataforma>-<arch>.node`),
compatíveis com Node e Electron, então não há reconstrução de ABI. A opção B só se justificaria
se fosse necessário um runtime Node separado por outro motivo.

**Nota de consulta ao Jev (`jev_route`):** a consulta ficou praticamente empatada
(B ≈ 0.51 vs. A ≈ 0.49, confiança baixa ~0.27), sinalizando que a decisão é de engenharia e
não de preferência óbvia. Decidimos pela opção A pela simplicidade de manter um só runtime.

> Variante descartada: executar o standalone **in-process** (sem child). Rejeitada porque
> carregaria o Next e o `better-sqlite3` no processo principal (bloqueio de evento loop,
> crashes do servidor derrubariam o app inteiro, e conflita com o design atual de processo
> separado para migrations).

---

## 5. Mudanças por arquivo

### 5.1 `next.config.ts`

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  output: "standalone", // gera .next/standalone/server.js + node_modules rastreado
  // better-sqlite3 está em serverExternalPackages e carrega o .node dinamicamente;
  // o nft não rastreia o binário de forma confiável — força a inclusão do pacote.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/better-sqlite3/**/*"],
  },
};

export default nextConfig;
```

- `output: "standalone"` faz o Next rastrear (`nft`) as dependências de servidor. **Não**
  copia automaticamente `.next/static`, `public`, `init.sql` nem `migrations/*.sql` (arquivos
  lidos via `fs`), que entram via `scripts/prepare-standalone.cjs`.
- **`better-sqlite3` é um caso especial.** Ele está na lista padrão de
  `serverExternalPackages` do Next (`node_modules/next/dist/lib/server-external-packages.json`)
  e o binding nativo é carregado **dinamicamente** por `node_modules/better-sqlite3/lib/binding.js`
  (`getPrebuildPath()` → `prebuilds/<plataforma>-<arch>.node`, ou `build/Release/better_sqlite3.node`),
  caminhos montados em tempo de execução que o `nft` **não** rastreia de forma confiável.
  Por isso `outputFileTracingIncludes` força a cópia de `node_modules/better-sqlite3/**/*` para o
  standalone. Como o tracing ainda pode omitir o `.node`, o `prepare-standalone.cjs` copia o
  pacote explicitamente (ver §5.9).

### 5.2 Novo `electron/resource-paths.cjs` (helper de caminhos)

Centraliza a distinção dev/repo vs. empacotado:

```js
const path = require("node:path");

// Raiz do standalone que contém server.js. No dev, aponta para o repositório.
function standaloneDir({ app, isDevelopment, __dirname }) {
  if (app.isPackaged) return path.join(process.resourcesPath, "app");
  if (isDevelopment) return path.resolve(__dirname, ".."); // repo (next dev)
  return path.resolve(__dirname, "../.next/standalone"); // produção local (desktop)
}

function databaseDir({ app, isDevelopment, __dirname }) {
  return path.join(
    standaloneDir({ app, isDevelopment, __dirname }),
    "database",
  );
}

module.exports = { standaloneDir, databaseDir };
```

### 5.3 `electron/main.cjs`

Adições (não reescrever o fluxo existente): single instance lock, AppUserModelId, ícone,
navegação externa e passagem dos novos diretórios ao servidor.

```js
const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { applyMigrations } = require("./database-migrations.cjs");
const { createDatabaseManager } = require("./database-manager.cjs");
const { createServerLifecycle } = require("./server-lifecycle.cjs");
const { standaloneDir } = require("./resource-paths.cjs");
const path = require("node:path");

const host = "127.0.0.1";
const isDevelopment = process.argv.includes("--dev");
const resourcesDir = standaloneDir({ app, isDevelopment, __dirname });
const dataDir = app.getPath("userData"); // %APPDATA%\CRMini

app.setAppUserModelId("br.com.crmini.app");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(createWindow).catch(/* como hoje */);
}

const server = createServerLifecycle({
  projectDir: path.resolve(__dirname, ".."),
  resourcesDir,
  dataDir,
  isDevelopment,
  host,
});

const databaseManager = createDatabaseManager({
  app,
  dialog,
  getMainWindow: () => mainWindow,
  beforeRestart: () => server.stop(),
  getServerUrl: () => server.url,
  resourcesDir, // passado p/ applyMigrations também
});

// applyMigrations({ databasePath, resourcesDir })

// ... dentro de createWindow, após carregar:
mainWindow.webContents.setWindowOpenHandler(({ url }) => {
  if (new URL(url).origin === new URL(server.url).origin)
    return { action: "allow" };
  shell.openExternal(url);
  return { action: "deny" };
});
mainWindow.webContents.on("will-navigate", (event, url) => {
  if (new URL(url).origin !== new URL(server.url).origin) {
    event.preventDefault();
    shell.openExternal(url);
  }
});
```

Ícone na janela (empacotado): `icon: app.isPackaged ? path.join(process.resourcesPath, "icon.ico") : undefined`.

### 5.4 `electron/server-lifecycle.cjs`

Trocar o `executable` de produção para o `server.js` standalone; manter o dev em `next dev`.
Novos parâmetros `resourcesDir` e `dataDir` viram env para o servidor.

```js
async function start(
  databasePath,
  { request = require("node:http").get, timeoutMs = 30000 } = {},
) {
  const port = await reservePort();
  url = `http://${host}:${port}`;
  const childEnv = {
    ...env,
    ELECTRON_RUN_AS_NODE: "1",
    HOSTNAME: host,
    PORT: String(port),
    SQLITE_PATH: databasePath,
    CRM_RESOURCES_DIR: resourcesDir,
    CRM_DATA_DIR: dataDir,
  };

  let executable, args, cwd;
  if (isDevelopment) {
    executable = path.join(
      projectDir,
      "node_modules",
      "next",
      "dist",
      "bin",
      "next",
    );
    args = [executable, "dev", "--hostname", host, "--port", String(port)];
    cwd = projectDir;
  } else {
    executable = path.join(resourcesDir, "server.js"); // standalone
    args = [executable];
    cwd = resourcesDir;
  }

  child = processSpawner(process.execPath, args, {
    cwd,
    stdio: "inherit",
    env: childEnv,
  });
  // ... restante (readiness/stop) inalterado
}
```

- O standalone `server.js` respeita `HOSTNAME` e `PORT` do env (comportamento padrão do Next).
- `reservePort()` continua garantindo porta livre e sem colisão entre instâncias.

### 5.5 `electron/database-migrations.cjs`

Default `migrateScript`/`cwd` passam a apontar para o standalone empacotado:

```js
function applyMigrations({
  databasePath,
  spawner = require("node:child_process").spawn,
  execPath = process.execPath,
  migrateScript, // default: path.join(resourcesDir, "database", "migrate.cjs")
  cwd, // default: resourcesDir (resolve better-sqlite3 do standalone)
  env = process.env,
  timeoutMs = 120000,
  killEscalationMs = 5000,
  resourcesDir = path.resolve(__dirname, "../database"), // fallback dev/repo
} = {}) {
  const script = migrateScript ?? path.join(resourcesDir, "migrate.cjs");
  const workDir = cwd ?? path.dirname(resourcesDir); // dev: repo; empacotado: resources/app
  // spawn igual ao atual, com ELECTRON_RUN_AS_NODE=1
}
```

- No dev, `main.cjs` passa `resourcesDir = <repo>/database` (ou usa o fallback), preservando o
  comportamento atual. No empacotado, `resourcesDir = <resources>/app/database`.

### 5.6 `src/lib/db.ts`

Resolver o diretório de recursos por env, com fallback para o comportamento atual:

```ts
const resourcesDir = process.env.CRM_RESOURCES_DIR ?? process.cwd();
const databaseDir = path.join(resourcesDir, "database");
const schemaFile = path.join(databaseDir, "init.sql");
const migrationsDir = path.join(databaseDir, "migrations");
```

- Em `npm run dev` (sem Electron), `CRM_RESOURCES_DIR` fica vazio → `process.cwd()/database`,
  idêntico ao atual. No Electron empacotado → `resources/app/database`.
- **Ponto de verificação:** confirmar que os `require("../../database/*.cjs")` (linhas 8–11)
  são rastreados pelo `nft` e copiados para `.next/standalone/database/`. Se o tracing não os
  incluir, trocar por `createRequire(import.meta.url)` resolvendo
  `path.join(databaseDir, "migrate.cjs")` / `"sqlite-paths.cjs"`. O caminho final deve sempre
  apontar para a cópia do standalone.

### 5.7 `src/app/api/logo/route.ts` e `src/app/api/logo/[name]/route.ts`

**Atualização (implementado):** a resolução saiu das rotas para `src/lib/logo-assets.ts` e o
diretório principal passou a ser `CRM_ASSETS_DIR` (derivado do diretório do banco em
`electron/assets-paths.cjs`), com `CRM_DATA_DIR/tmp/assets` e `process.cwd()/tmp/assets`
apenas como fallback de leitura. O restante desta seção fica como registro histórico.

Substituir `process.cwd()` por `CRM_DATA_DIR` com fallback (mantém `npm run dev` idêntico):

```ts
// route.ts (POST)
const dataDir = process.env.CRM_DATA_DIR ?? process.cwd();
const assetDir = path.join(dataDir, "tmp", "assets");
```

```ts
// [name]/route.ts (GET) — mesmo cálculo, sem divergência entre gravação e leitura
const dataDir = process.env.CRM_DATA_DIR ?? process.cwd();
const image = await readFile(path.join(dataDir, "tmp", "assets", name));
```

- No dev, continua em `repo/tmp/assets` (já no `.gitignore`). No empacotado, em
  `userData/tmp/assets`. Com a atualização acima, os logos ficam em `assets/` junto do banco
  escolhido, o que torna banco e imagens transportáveis na mesma cópia.

### 5.8 `package.json` — scripts

Adicionar scripts de empacotamento sem quebrar os atuais:

```jsonc
{
  "main": "electron/main.cjs",
  "scripts": {
    "prepare:standalone": "node scripts/prepare-standalone.cjs",
    "check:electron-abi": "node scripts/check-electron-abi.cjs",
    "desktop:build": "npm run build && npm run prepare:standalone",
    "desktop": "npm run desktop:build && npm run check:electron-abi && electron electron/main.cjs",
    "package:win": "npm run build && npm run prepare:standalone && electron-builder --win",
    "package:dir": "npm run build && npm run prepare:standalone && electron-builder --dir",
  },
}
```

- `main` aponta para o entrypoint do Electron (o `electron-builder` usa `main` do
  `package.json` quando não há `electron-builder.yml`).
- `desktop:build` sempre gera o standalone; `desktop` valida previamente que o
  `better-sqlite3` carrega no Electron (`check:electron-abi`) e falha com mensagem clara em vez
  de abrir a janela e estourar `NODE_MODULE_VERSION`.
- `desktop:dev` permanece como está (ver decisão em aberto §11).

### 5.9 Novo `scripts/prepare-standalone.cjs` (idempotente)

Implementação atual (exporta `prepareStandalone({ root })` para testes e mantém a CLI via
`require.main === module`):

- falha com mensagem clara se `.next/standalone/server.js` não existir;
- copia, com `rm` + `cpSync` recursivo (idempotente): `.next/static`, `public`, a pasta
  `database/` **inteira** — `init.sql`, `migrations/`, `migrate.cjs`, `sqlite-paths.cjs` e
  `seed.*` — e `node_modules/better-sqlite3`;
- ao copiar `database/`, ignora arquivos `*.sqlite`, `*.sqlite-wal`, `*.sqlite-shm` e backups
  (`*.sqlite.bak-*`), que são dados do usuário e não recursos do pacote;
- registra o destino e o aviso de que a cópia garante os prebuilds da plataforma/arquitetura
  alvo, que o tracing do Next pode não incluir.

> O `better-sqlite3` 13 publica prebuilds **N-API** (`prebuilds/<plataforma>-<arch>.node`), que
> carregam tanto no Node quanto no Electron. A cópia existe para garantir que o binário esteja
> presente no pacote — não para trocar ABI.

---

## 6. Configuração de empacotamento — `electron-builder.yml`

```yaml
appId: br.com.crmini.app
productName: CRMini
copyright: "Copyright © 2026 CRMini"

directories:
  output: dist
  buildResources: build

files:
  - electron/**/*
  - database/sqlite-paths.cjs # exigido pelo processo principal (validateDatabase)
  - package.json
  # node_modules de produção (inclui better-sqlite3) é incluído automaticamente

asarUnpack:
  - "**/*.node" # better_sqlite3.node fora do asar

extraResources:
  - from: .next/standalone
    to: app # vira resources/app (server.js + node_modules + .next + public + database)
  - from: build/icon.ico
    to: icon.ico

win:
  icon: build/icon.ico
  target:
    - nsis
    - portable

nsis:
  oneClick: true # instalação per-user, sem admin
  perMachine: false
  allowToChangeInstallationDirectory: false
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: CRMini
  deleteAppDataOnUninstall: false # NÃO apaga userData (banco/logos) ao desinstalar

portable:
  artifactName: ${productName}-${version}-portable.exe
```

Pontos importantes:

- **`asarUnpack`** é obrigatório para `better-sqlite3` no processo principal (arquivos `.node`
  não podem ser `require`d de dentro do `asar`). A cópia usada pelo servidor já fica fora do
  `asar` (em `resources/app/node_modules`, via `extraResources`).
- **`extraResources`** coloca o standalone em `resources/app`, fora do `asar`, permitindo
  spawnar `server.js` e resolver `better-sqlite3` normalmente.
- **`oneClick: true` + `perMachine: false`** = instalação em `%LOCALAPPDATA%`, sem UAC.
  O banco fica em `%APPDATA%` (perfil de usuário), separado dos binários.
- O ícone (`build/icon.ico`) é gerado a partir do asset existente (`public/brand/`) numa etapa
  de implementação; não existe ainda (ver §11).
- `deleteAppDataOnUninstall: false` garante que desinstalar/reinstalar **preserve** os dados.

### 6.1 Onde o instalador coloca cada coisa

Sim: o instalador NSIS cuida dos diretórios e atalhos, e o aplicativo só grava dados em pasta
gravável. O mapeamento recomendado (convenções do Windows para app per-user):

| Conteúdo                                                      | Diretório                                                       | Como é definido                       | Gravável?                                       |
| ------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------- |
| `CRMini.exe`, `resources/` (asar + standalone), desinstalador | `%LOCALAPPDATA%\Programs\CRMini`                                | NSIS `oneClick` + `perMachine: false` | Não (usuário pode escrever, mas o app não deve) |
| Banco SQLite, backups `.bak-*`                                | `%APPDATA%\CRMini`                                              | `app.getPath("userData")`             | Sim                                             |
| `preferences.json` (caminho do banco)                         | `%APPDATA%\CRMini`                                              | `app.getPath("userData")`             | Sim                                             |
| Logos enviados                                                | `<pasta do banco>\assets` (`%APPDATA%\CRMini\assets` no padrão) | `CRM_ASSETS_DIR`                      | Sim                                             |
| `database/init.sql`, `migrations/`                            | `resources\app\database`                                        | `CRM_RESOURCES_DIR`                   | Somente leitura                                 |

Comportamento esperado do instalador:

- **Sem UAC**: `perMachine: false` instala no perfil do usuário; não pede administrador e não
  toca em `Program Files`.
- **Atalhos**: menu Iniciar e desktop (`createStartMenuShortcut`/`createDesktopShortcut`),
  apontando para `CRMini.exe`.
- **Apps e recursos**: desinstalador registrado em `HKCU\...\Uninstall` (aparece em
  "Aplicativos instalados"), com nome, versão (de `package.json`) e fabricante.
- **Atualização/reinstalação**: instalar uma versão nova por cima substitui os binários e
  **preserva** `%APPDATA%\CRMini`; o banco e as preferências continuam válidos.
- **Desinstalação**: remove binários/atalhos/registro e **não apaga** `userData`
  (`deleteAppDataOnUninstall: false`).
- **Portable**: não instala nada; extrai o app para `%TEMP%` a cada execução e continua usando
  `%APPDATA%\CRMini` para dados. Não cria atalhos nem entrada de desinstalação.
- **Instância única**: o lock no `main.cjs` evita dois processos sobre o mesmo banco; o NSIS
  também encerra a instância em execução antes de atualizar.

Decisão a validar (§11): o `userData` do Electron é **Roaming** (`%APPDATA%`). Em ambientes com
perfis móveis corporativos, sincronizar um SQLite em WAL é risco de corrupção; nesse caso,
mover os dados para `%LOCALAPPDATA%\CRMini` via `app.setPath("userData", ...)` **antes** de
qualquer `app.getPath("userData")`. Isso não muda o instalador, só o diretório de dados.

O que o instalador **não** deve fazer: gravar o banco no diretório de instalação, migrar ou
apagar dados do usuário sem consentimento, ou exigir elevação. Se no futuro for necessário
instalar para todos os usuários (`perMachine: true`), o app passa a exigir admin e os dados
continuam por usuário — trade-off que deve ser decidido explicitamente.

---

## 7. Estratégia de build e CI

### 7.1 Ordem de build

O `better-sqlite3` 13 usa **Node-API** e não exige rebuild por runtime: os prebuilds
`prebuilds/<plataforma>-<arch>.node` servem tanto ao Node (build/testes) quanto ao Electron
(`ELECTRON_RUN_AS_NODE`). A ordem é simples:

```bash
npm ci                                  # 1. instala as dependências
npm test                                # 2. testes unitários
npm run lint                            # 3. análise estática
npm run build                           # 4. next build -> .next/standalone/server.js
npm run prepare:standalone              # 5. copia static/public/database e o better-sqlite3
npm run check:electron-abi              # 6. confirma que o nativo carrega no Electron (opcional)
electron-builder --win nsis portable    # 7. empacota
```

Pontos que continuam importantes:

- `next build` **executa** código de servidor. `src/app/page.tsx` lê o banco ao renderizar; sem
  `export const dynamic = "force-dynamic"` a rota é pré-renderizada
  (`initialRevalidateSeconds: false`) e o pacote serviria um snapshot do banco do build. A
  correção já está aplicada na página.
- O `nft` do Next copia `better-sqlite3`, mas o binding é carregado dinamicamente por
  `lib/binding.js`; por isso `outputFileTracingIncludes` no `next.config.ts` e a cópia explícita
  no `prepare-standalone.cjs` garantem o prebuild da plataforma alvo no pacote.
- `check:electron-abi` é uma verificação barata (executa `require("better-sqlite3")` no binário
  do Electron) e serve de diagnóstico se o prebuild da plataforma/arquitetura faltar.

### 7.2 GitHub Actions (`windows-latest`)

```yaml
name: build-windows
on:
  workflow_dispatch: {}
  push: { tags: ["v*"] }

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run lint
      - run: npm run build
      - run: npm run prepare:standalone
      - run: npm run check:electron-abi
      - run: npx electron-builder --win nsis portable --publish never
      - uses: actions/upload-artifact@v4
        with:
          name: crmini-windows
          path: dist/*.exe
```

- `npm ci` + `cache: npm` acelera builds.
- `check:electron-abi` confirma no runner que o prebuild N-API carrega sob `ELECTRON_RUN_AS_NODE`.
- Artefatos: `dist/CRMini Setup <versão>.exe` (NSIS) e `dist/CRMini <versão> portable.exe`.

### 7.3 Por que **não** fazer cross-build a partir do Linux

- O instalador NSIS e o empacotamento do Electron dependem de ferramentas e convenções do
  Windows (ícone, assinatura, atalhos, registro); o `windows-latest` já inclui tudo.
- O prebuild N-API é por plataforma: o pacote gerado no Linux seria `linux-x64` e não serve ao
  Windows. Cross-build via Wine para gerar um instalador Windows é frágil.
- Assinatura de código (Fase 4) exige certificado instalado em um runner Windows.
- Testar o artefato real (primeira execução, escolha de banco, upload de logo) só é confiável
  em um ambiente Windows.

---

## 8. Riscos e mitigações

| Risco                                                                                                                                                                                                                                                                      | Mitigação                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SmartScreen / assinatura** — instalador não assinado gera aviso "O Windows protegeu seu PC".                                                                                                                                                                             | Assinar com certificado de código (OV/EV) na Fase 4; acumular reputação; documentar o atalho "Mais informações → Executar mesmo assim" enquanto não assinado.                                                                                                                    |
| **Tamanho do pacote** — Electron (~200 MB instalados) é pesado para um CRM pequeno.                                                                                                                                                                                        | Aceitar no curto prazo; NSIS comprime bem; não embutir `node.exe` adicional (mantém tamanho menor); revisar `files` para não incluir fontes desnecessárias.                                                                                                                      |
| **Porta local e falta de autenticação na API** — a API Next fica exposta em `127.0.0.1`.                                                                                                                                                                                   | Manter bind em `127.0.0.1` e porta **aleatória** (`reservePort`); manter `contextIsolation` + `nodeIntegration: false`; restringir navegação externa; a validação de origem do IPC (`trustedSender`) já existe; avaliar um _token_ de sessão na URL (fora do escopo desta fase). |
| **Banco SQLite em uso / backup** — corrupção por dois processos ou desligamento brusco.                                                                                                                                                                                    | _Single instance lock_; WAL já habilitado; backups automáticos em migrations (`migrate.cjs`); documentar backup encerrando o app.                                                                                                                                                |
| **Migrations em recurso somente leitura** — `init.sql`/`migrations` ficam em `Program Files`/`resources`.                                                                                                                                                                  | Apenas **leitura** desses arquivos; escrita vai para o banco e backups em `userData`. Nunca gravar no diretório de instalação.                                                                                                                                                   |
| **Atualização automática** (fora do escopo) — atualizar pode trocar migrations/ABI.                                                                                                                                                                                        | Adiar para Fase 4 com `electron-updater`; manter migrations append-only; a checagem de versões desconhecidas do `migrate.cjs` já protege contra downgrade.                                                                                                                       |
| **Antivírus** — falsos positivos em instaladores NSIS e em `.node` nativo.                                                                                                                                                                                                 | Assinatura ajuda; submeter à análise da Microsoft; evitar ofuscação.                                                                                                                                                                                                             |
| **Prebuild nativo ausente no standalone** — `better-sqlite3` carrega o `.node` dinamicamente e o tracing pode não incluí-lo.                                                                                                                                               | `outputFileTracingIncludes` no `next.config.ts`, cópia explícita no `prepare-standalone.cjs` e `check:electron-abi` no CI/pacote.                                                                                                                                                |
| **Divergência dev × build: rotas pré-renderizadas** — `/` era pré-renderizada no build (`initialRevalidateSeconds: false` no `.next/prerender-manifest.json`) e lê o banco em `src/app/page.tsx`; no pacote o dashboard serviria um snapshot do banco do momento do build. | Corrigido com `export const dynamic = "force-dynamic"` em `/`; verificar no pacote: criar cliente, voltar ao dashboard e confirmar números atualizados.                                                                                                                          |
| **`cwd`/`process.cwd()` residual** em algum outro ponto                                                                                                                                                                                                                    | Grep por `process.cwd()` antes de fechar a Fase 1 (atualmente: `db.ts` e rotas de logo).                                                                                                                                                                                         |

---

## 9. Testes e verificação

### 9.1 Testes Vitest existentes e impacto

| Arquivo                                        | Impacto                                                                                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/electron-server-lifecycle.test.ts`    | **Alterar.** Assertiva da linha 26 espera `next/dist/bin/next`. Passa a esperar `server.js` (prod) com `resourcesDir`; manter caso de dev em `next dev`.                        |
| `src/lib/electron-database-migrations.test.ts` | **Baixo.** Usa `migrateScript`/`cwd` injetados; adicionar caso com `resourcesDir` empacotado (default `migrate.cjs` sob `resources/app/database`).                              |
| `src/lib/electron-preload.test.ts`             | **Sem impacto.** `preload.cjs` permanece em `electron/`.                                                                                                                        |
| `src/lib/sqlite-paths.test.ts`                 | **Sem impacto.** Comportamento de caminhos não muda; adicionar caso p/ `userData` em Windows já coberto.                                                                        |
| `src/lib/db.test.ts`                           | **Complementar.** `SQLITE_PATH=:memory:` segue funcionando; adicionar caso que valida fallback `CRM_RESOURCES_DIR` vazio → `cwd`, e override apontando p/ diretório temporário. |
| `src/lib/electron-next-command.test.ts`        | **Revisar.** `next-command.cjs` não é mais usado pelo lifecycle; decidir entre remover ou manter p/ dev (ver §11).                                                              |
| `src/lib/electron-database-manager.test.ts`    | **Sem impacto funcional.** O fallback `port=3174` é inerte (main injeta `server.url`); pode-se limpar.                                                                          |

### 9.2 Novos testes necessários

1. **`server-lifecycle` empacotado:** spawn de `process.execPath` com `[resourcesDir/server.js]`,
   `cwd = resourcesDir`, e env com `ELECTRON_RUN_AS_NODE`, `HOSTNAME`, `PORT`, `SQLITE_PATH`,
   `CRM_RESOURCES_DIR`, `CRM_DATA_DIR`, `CRM_ASSETS_DIR`.
2. **Resolução de dados** (`db.ts` e rotas de logo): com `CRM_ASSETS_DIR` apontando p/ diretório
   temporário, escrever/ler lá; com só `CRM_DATA_DIR`, ler o legado; sem nenhum dos dois, cair
   no `process.cwd()` (não regredir `npm run dev`).
3. **Migrations em resources:** `applyMigrations` com `resourcesDir` temporário apontando p/
   `migrate.cjs` e validando que o script e o `cwd` corretos são passados.
4. **`prepare-standalone.cjs`:** idempotência (rodar duas vezes) e presença de
   `.next/static`, `public`, `database/` (sem `.sqlite`/WAL/backups) e
   `node_modules/better-sqlite3` no standalone.

### 9.3 Roteiro manual de verificação no Windows

1. **Instalar** o NSIS per-user (sem admin) e o portable; abrir ambos.
2. **Primeira execução:** caixa de escolha de banco aparece; "Usar padrão" cria
   `%APPDATA%\CRMini\crm.sqlite`; migrations aplicadas (log visível).
3. **Criar cliente** e conferir persistência após fechar/reabrir.
4. **Upload de logo** (PNG/JPG/WebP ≤ 2 MB): confirmar gravação em `assets/` junto do banco e
   exibição correta após reiniciar; mover a pasta do banco + `assets/` para outra máquina e
   confirmar que os logos continuam aparecendo.
5. **Reinstalar** (desinstalar e reinstalar) **sem perder dados**: banco, logos e
   `preferences.json` preservados (`deleteAppDataOnUninstall: false`).
6. **Dashboard dinâmico:** criar um cliente/oportunidade, voltar ao `/` e confirmar que os
   números refletem o banco atual (prova de que a rota não ficou pré-renderizada no build).
7. **Desinstalar**: confirmar que binários somem e que o diretório `userData` permanece
   (decisão de apagar/não apagar deve ser documentada).
8. **Segunda instância**: abrir o executável de novo deve focar a janela existente (lock).
9. **Navegação externa**: links externos abrem no navegador, não dentro da janela.
10. **Banco em uso**: com o app aberto, uma segunda cópia (portable) não deve abrir o mesmo
    banco (lock + validação).

---

## 10. Faseamento

### Fase 0 — Caminhos e ambiente (`CRM_RESOURCES_DIR` / `CRM_DATA_DIR` / `CRM_ASSETS_DIR`)

Mudar `src/lib/db.ts`, as duas rotas de logo e criar `electron/resource-paths.cjs`; passar
`resourcesDir`/`dataDir` pelo `server-lifecycle` para o env. Manter dev/repo inalterado. Os
logos foram além dessa fase: `electron/assets-paths.cjs` deriva `CRM_ASSETS_DIR` do diretório
do banco e move uma única vez os logos legados de `<userData>/tmp/assets`.

**Critérios de aceite:** `npm run dev`, `desktop:dev` e `desktop` funcionam como hoje; testes
existentes verdes + novos testes de resolução de caminhos.

### Fase 1 — Standalone

`output: "standalone"` no `next.config.ts` (+ `outputFileTracingIncludes` do
`better-sqlite3`); `server-lifecycle` spawna `server.js`; `database-migrations` aponta p/
standalone; criar `scripts/prepare-standalone.cjs`; ajustar testes do lifecycle; corrigir a
pré-renderização de `/` (`export const dynamic = "force-dynamic"`) e auditar rotas server-side.

**Critérios de aceite:** `npm run build && npm run desktop` roda a produção a partir de
`.next/standalone`; upload de logo e migrations funcionam; dashboard reflete dados criados em
tempo de execução; `npm test` verde.

### Fase 2 — Instalador

`electron-builder.yml` + `electron-builder` como devDependency; hardening do `main.cjs`
(lock, AppUserModelId, ícone, navegação externa); `asarUnpack` + `extraResources`;
`prepare:standalone` e `check:electron-abi` na ordem da §7.1.

**Critérios de aceite:** gera NSIS + portable; instala per-user; primeira execução escolhe
banco; dados em `%APPDATA%`; reinstalar preserva dados; roteiro §9.3 aprovado.

### Fase 3 — CI

Workflow `windows-latest` com ordem de build da §7.1, cache de npm e upload de artefatos.

**Critérios de aceite:** pipeline verde em push de tag; artefatos `.exe` baixáveis; smoke test
que valida ABI do standalone.

### Fase 4 — Assinatura e updater (depende de decisões do usuário)

Certificado de código, integração `electron-updater` + servidor de releases, submissão de
reputação.

**Critérios de aceite:** binários assinados (sem aviso SmartScreen); atualização automática
funcional com rollback seguro.

---

## 11. Decisões em aberto (para o usuário aprovar)

1. **Assinatura de código:** adquirir certificado OV/EV agora (Fase 4) ou lançar sem assinatura
   e aceitar o aviso do SmartScreen?
2. **Updater:** `electron-updater` entra no escopo? Qual servidor de releases (GitHub Releases,
   S3, etc.)?
3. **`desktop`/`desktop:dev`:** manter `desktop` como `next start` ou unificá-lo para rodar o
   standalone (mesma rota do pacote)? Recomendado unificar para exercitar o caminho de produção
   localmente.
4. **Local dos logos (decidido):** `assets/` na pasta do banco em uso, propagado como
   `CRM_ASSETS_DIR`; os logos legados de `userData/tmp/assets` são movidos uma única vez e o
   diretório legado permanece como fallback de leitura.
5. **Identidade do app:** `appId`, `productName` e arte final do ícone (`.ico` a partir de
   `public/brand/crmini-symbol.svg`).
6. **Targets:** apenas `nsis` + `portable`, ou incluir `msi`? Arquitetura `x64` apenas?
7. **`next-command.cjs`:** remover (não usado) ou manter para fins de teste/dev?
8. **Desinstalação:** apagar ou preservar `userData` ao desinstalar (recomendado preservar, mas
   exige botão explícito de "apagar meus dados" no futuro).
9. **Diretório de dados:** manter `%APPDATA%` (Roaming, padrão do Electron) ou mover para
   `%LOCALAPPDATA%` para evitar sincronização de SQLite/WAL em perfis móveis corporativos.
10. **Escopo da instalação:** per-user em `%LOCALAPPDATA%\Programs` (sem admin, recomendado) ou
    per-machine em `Program Files` (exige admin, dados continuam por usuário).

---

## 12. Observações de implementação (quando a fase iniciar)

- Atualizar `README.md` e `electron/README.md` com os novos comandos (`npm run package:win`,
  ordem de build, requisito de `build/icon.ico`) — **não** alterar neste documento.
- Adicionar `dist/` e (se gerado) `build/` ao `.gitignore`.
- Adicionar `electron-builder` às devDependencies (permitido apenas na fase de implementação).
- Grep final por `process.cwd()` para garantir que nenhum outro consumidor dependa do
  diretório de execução.

---

_Fim do documento. Nenhum arquivo de produção foi alterado por este plano._
