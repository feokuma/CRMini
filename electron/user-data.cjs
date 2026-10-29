const path = require("node:path");

// Pasta de dados usada até a padronização do nome: `appData/<name>` do
// package.json ("crmini"), em vez do `productName` ("CRMini").
function legacyUserDataDir(appDataDir) {
  return path.join(appDataDir, "crmini");
}

// Um diretório existe mas está vazio quando `readdirSync` devolve zero entradas;
// qualquer falha (inexistente, sem permissão) é tratada como "sem conteúdo".
function hasContent(dir, fs) {
  try {
    return fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

// Em sistemas case-insensitive (Windows, macOS), duas grafias do mesmo caminho
// resolvem para o mesmo diretório físico; `realpath` revela a caixa real.
function samePath(first, second, fs) {
  try {
    return fs.realpathSync(first) === fs.realpathSync(second);
  } catch {
    return false;
  }
}

// Copia recursivamente o conteúdo de `from` para `to`, preservando arquivos
// (bytes intactos), subdiretórios e links simbólicos. Usa apenas operações
// síncronas para manter o comportamento do processo principal no Electron.
function copyRecursive(from, to, fs) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(source, target, fs);
    } else if (entry.isSymbolicLink()) {
      fs.symlinkSync(fs.readlinkSync(source), target);
    } else if (entry.isFile()) {
      fs.copyFileSync(source, target);
    }
  }
}

// Migra a pasta de dados legada (`appData/crmini`) para a nova (`CRMini`) uma
// única vez, sem perder nada. Nunca lança: devolve o desfecho para o chamador
// decidir como reportar e como proceder (inclusive o fallback em caso de falha).
function migrateLegacyUserData({
  appDataDir,
  userDataDir,
  fs = require("node:fs"),
  logger = console,
} = {}) {
  const legacy = legacyUserDataDir(appDataDir);

  // Mesma pasta (dev/seed já usando `CRMini`): não há o que migrar.
  if (legacy === userDataDir) {
    return { migrated: false, reason: "same" };
  }

  let legacyExists = false;
  try {
    legacyExists = fs.existsSync(legacy);
  } catch {
    legacyExists = false;
  }
  if (!legacyExists) {
    // Instalação nova: o legado nunca existiu.
    return { migrated: false, reason: "fresh" };
  }

  let userDataExists = false;
  try {
    userDataExists = fs.existsSync(userDataDir);
  } catch {
    userDataExists = false;
  }

  // Em Windows/macOS o sistema de arquivos é case-insensitive: `crmini` e
  // `CRMini` são a mesma pasta e já contêm os mesmos dados. Sem esta checagem,
  // todo início cairia em "both" e registraria um aviso enganoso.
  if (userDataExists && samePath(legacy, userDataDir, fs)) {
    return { migrated: false, reason: "same" };
  }

  if (userDataExists && hasContent(userDataDir, fs)) {
    // As duas pastas têm dados: não mexe em nada; a nova passa a valer.
    logger.warn(
      `As pastas "${legacy}" e "${userDataDir}" existem com dados; a nova ("${userDataDir}") será usada.`,
    );
    return { migrated: false, reason: "both" };
  }

  // A nova não existe ou está vazia: libera o lugar para o `rename`.
  if (userDataExists) {
    try {
      fs.rmdirSync(userDataDir);
    } catch {
      // Ignorado: se sobrar a pasta vazia, o `rename` falha e a cópia assume.
    }
  }

  try {
    fs.renameSync(legacy, userDataDir);
    return { migrated: true, reason: "renamed" };
  } catch {
    // EXDEV (entre discos) ou qualquer outro motivo: copia o conteúdo mantendo
    // o legado intacto.
    try {
      copyRecursive(legacy, userDataDir, fs);
      logger.warn(
        `A pasta antiga "${legacy}" foi preservada após copiar para "${userDataDir}"; pode ser removida manualmente.`,
      );
      return { migrated: true, reason: "copied" };
    } catch (error) {
      // Remove apenas o que esta chamada criou e garante o legado intacto.
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      } catch {
        // Ignorado: o fallback do chamador ainda usa o legado.
      }
      return { migrated: false, reason: "failed", error };
    }
  }
}

module.exports = { legacyUserDataDir, migrateLegacyUserData };
