const path = require("node:path");

// Extensões de imagem aceitas na migração dos logos legados (em minúsculas).
const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "webp"]);

// Pasta de imagens derivada do banco em uso: `<dirname do banco>/assets`.
// `resolve` garante caminho absoluto mesmo quando `SQLITE_PATH` é relativo
// (ex.: `./database/crm.sqlite` no `.env.local`), que de outro modo seria
// interpretado a partir do cwd do processo filho do Next.
// Sem banco real (vazio ou `:memory:`) não há onde derivar: `undefined`.
function defaultAssetsDir(databasePath) {
  if (!databasePath || databasePath === ":memory:") return undefined;
  return path.join(path.dirname(path.resolve(databasePath)), "assets");
}

// Diretório legado de logos, hoje `<userData>/tmp/assets`.
function legacyAssetsDir(dataDir) {
  return path.join(dataDir, "tmp", "assets");
}

// Resolve a pasta de imagens: derivada do banco quando existir; senão, legado.
// No v1 não há override manual (fase 2 futura), apenas exibição em Configurações.
function assetsDirFor({ databasePath, dataDir }) {
  return defaultAssetsDir(databasePath) ?? legacyAssetsDir(dataDir);
}

// Cria o diretório de assets; falha é tolerada e só aparece no momento do uso.
function ensureAssetsDir(dir, { fs = require("node:fs") } = {}) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // Ignorado de propósito: a escrita que falhar gera o erro na gravação.
  }
}

// Move, uma única vez, os logos legados para a pasta derivada do banco. Por
// arquivo regular de extensão suportada: `rename` e, em EXDEV (entre discos),
// `copyFile` + `unlink`. Não sobrescreve destino nem remove origem em falha.
// Nunca lança; devolve os contadores para o chamador decidir como reportar.
function moveLegacyAssets({
  legacyDir,
  destination,
  fs = require("node:fs"),
  logger = console,
} = {}) {
  const result = { moved: 0, skipped: 0, failed: 0 };
  if (legacyDir === destination) return result;
  let entries;
  try {
    entries = fs.readdirSync(legacyDir, { withFileTypes: true });
  } catch {
    // Inexistente, inacessível ou não é diretório: nada a mover.
    return result;
  }
  ensureAssetsDir(destination, { fs });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).slice(1).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) continue;
    const source = path.join(legacyDir, entry.name);
    const target = path.join(destination, entry.name);
    if (fs.existsSync(target)) {
      // Destino já existe: não sobrescreve e não toca na origem.
      result.skipped += 1;
      continue;
    }
    try {
      fs.renameSync(source, target);
      result.moved += 1;
    } catch (error) {
      if (error && error.code === "EXDEV") {
        try {
          fs.copyFileSync(source, target);
          fs.unlinkSync(source);
          result.moved += 1;
        } catch (copyError) {
          result.failed += 1;
          logger.warn(
            `Não foi possível mover "${source}": ${copyError.message}`,
          );
        }
      } else {
        result.failed += 1;
        logger.warn(`Não foi possível mover "${source}": ${error.message}`);
      }
    }
  }
  // Remove o legado só se ficou vazio; erro (não vazio, reaparecido) é ignorado.
  try {
    fs.rmdirSync(legacyDir);
  } catch {
    // Ignorado de propósito.
  }
  return result;
}

module.exports = {
  defaultAssetsDir,
  legacyAssetsDir,
  assetsDirFor,
  ensureAssetsDir,
  moveLegacyAssets,
};
