import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type AssetDirs = { write: string; read: string[] };

const allowedLogoName = /^[\w-]+\.(png|jpg|webp)$/;

function candidateDirs(env: NodeJS.ProcessEnv): string[] {
  const dirs: string[] = [];
  if (env.CRM_ASSETS_DIR) {
    dirs.push(env.CRM_ASSETS_DIR);
  }
  if (env.CRM_DATA_DIR) {
    dirs.push(path.join(env.CRM_DATA_DIR, "tmp", "assets"));
  }
  dirs.push(path.join(process.cwd(), "tmp", "assets"));
  return dirs;
}

/**
 * Resolve onde os logos são gravados e lidos. A escrita usa o primeiro caminho
 * disponível (`CRM_ASSETS_DIR` → `CRM_DATA_DIR/tmp/assets` → `cwd/tmp/assets`);
 * a leitura tenta o caminho de escrita e, em seguida, os fallbacks restantes,
 * preservando a ordem e removendo duplicatas.
 */
export function resolveAssetDirs(
  env: NodeJS.ProcessEnv = process.env,
): AssetDirs {
  const read = Array.from(new Set(candidateDirs(env)));
  return { write: read[0], read };
}

export function isAllowedLogoName(name: string): boolean {
  return allowedLogoName.test(name);
}

export async function saveLogo(
  bytes: Uint8Array,
  extension: string,
): Promise<string> {
  const { write } = resolveAssetDirs();
  await mkdir(write, { recursive: true });
  const name = `${randomUUID()}.${extension}`;
  await writeFile(path.join(write, name), Buffer.from(bytes));
  return `/api/logo/${name}`;
}

export async function readLogo(name: string): Promise<Buffer | null> {
  if (!isAllowedLogoName(name)) {
    return null;
  }
  const { read } = resolveAssetDirs();
  for (const dir of read) {
    try {
      return await readFile(path.join(dir, name));
    } catch {
      // Arquivo ausente (ou diretório ilegível) neste caminho: tenta o próximo.
    }
  }
  return null;
}
