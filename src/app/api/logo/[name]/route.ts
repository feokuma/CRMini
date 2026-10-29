import { NextResponse } from "next/server";
import { isAllowedLogoName, readLogo } from "@/lib/logo-assets";

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
  if (!isAllowedLogoName(name))
    return new NextResponse(null, { status: 404 });
  const image = await readLogo(name);
  if (image === null) return new NextResponse(null, { status: 404 });
  // `Uint8Array` é um `ArrayBufferView` aceito pelo `BodyInit`; `Buffer` não é.
  return new NextResponse(new Uint8Array(image), {
    headers: {
      "Content-Type": contentTypes[name.split(".").pop() ?? "png"],
      "Cache-Control": "public, max-age=3600",
    },
  });
}
