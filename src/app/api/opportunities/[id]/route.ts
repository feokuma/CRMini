import { NextRequest, NextResponse } from "next/server";
import {
  changeOpportunityStatus,
  updateOpportunity,
} from "@/lib/repositories/opportunities";

export const runtime = "nodejs";
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let body: { status?: string; loss_reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo JSON inválido." },
      { status: 400 },
    );
  }
  const statuses = [
      "Em andamento",
      "Desenvolvimento",
      "Proposta",
      "Aceite da proposta",
      "Ganha",
      "Perdida",
    ],
    reasons = ["Preço", "Prazo", "Tecnologia", "Solução"];
  if (
    !statuses.includes(String(body.status)) ||
    (body.status === "Perdida"
      ? !reasons.includes(String(body.loss_reason))
      : Boolean(body.loss_reason))
  )
    return NextResponse.json(
      { error: "Status ou motivo de perda inválido." },
      { status: 400 },
    );
  try {
    const { id } = await params;
    const result = await changeOpportunityStatus(
      id,
      body.status!,
      body.loss_reason || null,
    );
    if (!result.rowCount)
      return NextResponse.json(
        { error: "Oportunidade não encontrada." },
        { status: 404 },
      );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível alterar o status." },
      { status: 400 },
    );
  }
}
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo JSON inválido." },
      { status: 400 },
    );
  }
  const { id } = await params;
  if (
    typeof body.name !== "string" ||
    !body.name.trim() ||
    !body.client_id ||
    !body.contact_id
  )
    return NextResponse.json(
      { error: "Informe nome, cliente e contato." },
      { status: 400 },
    );
  const statuses = [
      "Em andamento",
      "Desenvolvimento",
      "Proposta",
      "Aceite da proposta",
      "Ganha",
      "Perdida",
    ],
    reasons = ["Preço", "Prazo", "Tecnologia", "Solução"],
    currencies = ["BRL", "USD", "EUR", "PES"];
  if (
    !statuses.includes(String(body.status)) ||
    (body.status === "Perdida"
      ? !reasons.includes(String(body.loss_reason))
      : Boolean(body.loss_reason))
  )
    return NextResponse.json(
      { error: "Status ou motivo de perda inválido." },
      { status: 400 },
    );
  for (const key of ["value", "budget", "project_hours"])
    if (
      body[key] != null &&
      body[key] !== "" &&
      (!Number.isFinite(Number(body[key])) || Number(body[key]) < 0)
    )
      return NextResponse.json(
        { error: `O campo ${key} deve ser um número não negativo.` },
        { status: 400 },
      );
  if (
    !currencies.includes(String(body.currency)) ||
    (body.budget_currency && !currencies.includes(String(body.budget_currency)))
  )
    return NextResponse.json({ error: "Moeda inválida." }, { status: 400 });
  try {
    const result = await updateOpportunity(id, body);
    if (!result.rowCount)
      return NextResponse.json(
        { error: "Oportunidade ou associação válida não encontrada." },
        { status: 404 },
      );
    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível atualizar a oportunidade." },
      { status: 400 },
    );
  }
}
