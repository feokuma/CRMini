import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const assetDir = path.join(process.cwd(), "tmp", "assets");
const mimeExtensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Selecione uma imagem." }, { status: 400 });
  const extension = mimeExtensions[file.type];
  if (!extension) return NextResponse.json({ error: "Formato permitido: PNG, JPG ou WebP." }, { status: 400 });
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "A imagem deve ter no máximo 2 MB." }, { status: 400 });
  await mkdir(assetDir, { recursive: true });
  const name = `${randomUUID()}.${extension}`;
  await writeFile(path.join(assetDir, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ logo_path: `/api/logo/${name}` });
}
