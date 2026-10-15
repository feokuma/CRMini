import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
const contentTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!/^[\w-]+\.(png|jpg|webp)$/.test(name))
    return new NextResponse(null, { status: 404 });
  try {
    const image = await readFile(
      path.join(process.cwd(), "tmp", "assets", name),
    );
    return new NextResponse(image, {
      headers: {
        "Content-Type": contentTypes[name.split(".").pop()!],
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
