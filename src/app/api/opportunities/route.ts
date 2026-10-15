import { NextRequest, NextResponse } from "next/server";
import {
  createOpportunity,
  listOpportunities,
} from "@/lib/repositories/opportunities";

export const runtime = "nodejs";
const statuses = [
  "Em andamento",
  "Desenvolvimento",
  "Proposta",
  "Aceite da proposta",
  "Ganha",
  "Perdida",
];
const reasons = ["Preço", "Prazo", "Tecnologia", "Solução"];
const currencies = ["BRL", "USD", "EUR", "PES"];

function validate(body: Record<string, unknown>) {
  if (
    typeof body.name !== "string" ||
    !body.name.trim() ||
    typeof body.client_id !== "string" ||
    typeof body.contact_id !== "string"
  )
    return "Informe nome, cliente e contato.";
  if (!statuses.includes(String(body.status ?? "Em andamento")))
    return "Status inválido.";
  if (
    body.status === "Perdida"
      ? !reasons.includes(String(body.loss_reason))
      : body.loss_reason != null && body.loss_reason !== ""
  )
    return "Informe um motivo apenas para oportunidades perdidas.";
  for (const key of ["value", "budget", "project_hours"])
    if (
      body[key] != null &&
      body[key] !== "" &&
      (!Number.isFinite(Number(body[key])) || Number(body[key]) < 0)
    )
      return `O campo ${key} deve ser um número não negativo.`;
  if (body.currency != null && !currencies.includes(String(body.currency)))
    return "Moeda inválida.";
  if (
    body.budget_currency != null &&
    body.budget_currency !== "" &&
    !currencies.includes(String(body.budget_currency))
  )
    return "Moeda do budget inválida.";
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    return NextResponse.json(
      await listOpportunities(
        searchParams.get("q")?.trim() || null,
        searchParams.get("client_id") || null,
        searchParams.get("status") || null,
      ),
    );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar as oportunidades." },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo JSON inválido." },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const error = validate(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  try {
    const result = await createOpportunity(body);
    if (!result.rowCount)
      return NextResponse.json(
        { error: "Cliente ativo ou contato válido não encontrado." },
        { status: 400 },
      );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível cadastrar a oportunidade." },
      { status: 400 },
    );
  }
}
