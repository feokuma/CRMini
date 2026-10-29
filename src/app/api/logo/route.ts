import { NextRequest, NextResponse } from "next/server";
import { saveLogo } from "@/lib/logo-assets";

export const runtime = "nodejs";
const mimeExtensions: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File))
    return NextResponse.json(
      { error: "Selecione uma imagem." },
      { status: 400 },
    );
  const extension = mimeExtensions[file.type];
  if (!extension)
    return NextResponse.json(
      { error: "Formato permitido: PNG, JPG ou WebP." },
      { status: 400 },
    );
  if (file.size > 2 * 1024 * 1024)
    return NextResponse.json(
      { error: "A imagem deve ter no máximo 2 MB." },
      { status: 400 },
    );
  try {
    const logoPath = await saveLogo(
      new Uint8Array(await file.arrayBuffer()),
      extension,
    );
    return NextResponse.json({ logo_path: logoPath });
  } catch {
    return NextResponse.json(
      {
        error:
          "Não foi possível salvar a imagem. Verifique se a pasta do banco está disponível e gravável.",
      },
      { status: 500 },
    );
  }
}
