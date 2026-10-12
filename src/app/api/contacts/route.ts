import { NextRequest, NextResponse } from "next/server";
import { listContacts } from "@/lib/repositories/contacts";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || null;
  const industry = request.nextUrl.searchParams.get("segment")?.trim() || null;
  try {
    return NextResponse.json(await listContacts(query, industry));
  } catch (error) {
    console.error("Failed to list contacts", error);
    return NextResponse.json({ error: "Não foi possível carregar os contatos." }, { status: 503 });
  }
}
