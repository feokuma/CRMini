import { NextRequest, NextResponse } from "next/server";
import { getContact, updateContact } from "@/lib/repositories/contacts";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const contact = await getContact(id);
    return contact ? NextResponse.json(contact) : NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });
  } catch (error) {
    console.error("Failed to load contact", error);
    return NextResponse.json({ error: "Não foi possível carregar o contato." }, { status: 503 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (typeof body.full_name !== "string" || !body.full_name.trim())
    return NextResponse.json({ error: "Informe o nome do contato." }, { status: 400 });
  try {
    const contact = await updateContact(id, body);
    return contact ? NextResponse.json(contact) : NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });
  } catch (error) {
    console.error("Failed to update contact", error);
    return NextResponse.json({ error: "Não foi possível atualizar o contato." }, { status: 500 });
  }
}
