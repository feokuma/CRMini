import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
const statuses = ["Em andamento", "Desenvolvimento", "Proposta", "Aceite da proposta", "Ganha", "Perdida"];
const reasons = ["Preço", "Prazo", "Tecnologia", "Solução"];
const currencies = ["BRL", "USD", "EUR", "PES"];
const fields = ["name", "client_id", "contact_id", "technology", "value", "currency", "service_type", "resources", "budget", "budget_currency", "notes", "customer_need", "offered_solution", "project_hours", "opened_at", "expected_close_at", "status", "loss_reason"];

function validate(body: Record<string, unknown>) {
  if (typeof body.name !== "string" || !body.name.trim() || typeof body.client_id !== "string" || typeof body.contact_id !== "string") return "Informe nome, cliente e contato.";
  if (!statuses.includes(String(body.status ?? "Em andamento"))) return "Status inválido.";
  if (body.status === "Perdida" ? !reasons.includes(String(body.loss_reason)) : body.loss_reason != null && body.loss_reason !== "") return "Informe um motivo apenas para oportunidades perdidas.";
  for (const key of ["value", "budget", "project_hours"]) if (body[key] != null && body[key] !== "" && (!Number.isFinite(Number(body[key])) || Number(body[key]) < 0)) return `O campo ${key} deve ser um número não negativo.`;
  if (body.currency != null && !currencies.includes(String(body.currency))) return "Moeda inválida.";
  if (body.budget_currency != null && body.budget_currency !== "" && !currencies.includes(String(body.budget_currency))) return "Moeda do budget inválida.";
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const result = await pool.query(`SELECT o.*, c.company_name, p.full_name AS contact_name FROM opportunities o JOIN clients c ON c.id=o.client_id JOIN contacts p ON p.id=o.contact_id AND p.client_id=o.client_id
      WHERE ($1::text IS NULL OR o.name ILIKE '%'||$1||'%' OR c.company_name ILIKE '%'||$1||'%' OR p.full_name ILIKE '%'||$1||'%') AND ($2::uuid IS NULL OR o.client_id=$2) AND ($3::text IS NULL OR o.status=$3) ORDER BY o.created_at DESC`, [searchParams.get("q")?.trim() || null, searchParams.get("client_id") || null, searchParams.get("status") || null]);
    return NextResponse.json(result.rows);
  } catch { return NextResponse.json({ error: "Não foi possível carregar as oportunidades." }, { status: 503 }); }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const error = validate(body); if (error) return NextResponse.json({ error }, { status: 400 });
  const columns = fields.filter((field) => body[field] !== undefined);
  const values = columns.map((field) => body[field] === "" ? null : body[field]);
  try {
    const result = await pool.query(`INSERT INTO opportunities (${columns.join(",")}) SELECT ${columns.map((_, i) => `$${i + 1}`).join(",")} WHERE EXISTS (SELECT 1 FROM clients c WHERE c.id=$${columns.indexOf("client_id") + 1} AND c.is_active) AND EXISTS (SELECT 1 FROM contacts p WHERE p.id=$${columns.indexOf("contact_id") + 1} AND p.client_id=$${columns.indexOf("client_id") + 1}) RETURNING *`, values);
    if (!result.rowCount) return NextResponse.json({ error: "Cliente ativo ou contato válido não encontrado." }, { status: 400 });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch { return NextResponse.json({ error: "Não foi possível cadastrar a oportunidade." }, { status: 400 }); }
}
