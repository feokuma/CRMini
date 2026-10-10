import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let body: { status?: string; loss_reason?: string }; try { body = await request.json(); } catch { return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 }); }
  const statuses = ["Em andamento", "Desenvolvimento", "Proposta", "Aceite da proposta", "Ganha", "Perdida"], reasons = ["Preço", "Prazo", "Tecnologia", "Solução"];
  if (!statuses.includes(String(body.status)) || (body.status === "Perdida" ? !reasons.includes(String(body.loss_reason)) : Boolean(body.loss_reason))) return NextResponse.json({ error: "Status ou motivo de perda inválido." }, { status: 400 });
  try { const { id } = await params; const result = await pool.query("UPDATE opportunities SET status=$2, loss_reason=$3, updated_at=NOW() WHERE id=$1 RETURNING id", [id, body.status, body.loss_reason || null]); if (!result.rowCount) return NextResponse.json({ error: "Oportunidade não encontrada." }, { status: 404 }); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: "Não foi possível alterar o status." }, { status: 400 }); }
}
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 }); }
  const { id } = await params;
  const fields = ["name", "client_id", "contact_id", "technology", "value", "currency", "service_type", "resources", "budget", "budget_currency", "notes", "customer_need", "offered_solution", "project_hours", "opened_at", "expected_close_at", "status", "loss_reason"];
  if (typeof body.name !== "string" || !body.name.trim() || !body.client_id || !body.contact_id) return NextResponse.json({ error: "Informe nome, cliente e contato." }, { status: 400 });
  const statuses = ["Em andamento", "Desenvolvimento", "Proposta", "Aceite da proposta", "Ganha", "Perdida"], reasons = ["Preço", "Prazo", "Tecnologia", "Solução"], currencies = ["BRL", "USD", "EUR", "PES"];
  if (!statuses.includes(String(body.status)) || (body.status === "Perdida" ? !reasons.includes(String(body.loss_reason)) : Boolean(body.loss_reason))) return NextResponse.json({ error: "Status ou motivo de perda inválido." }, { status: 400 });
  for (const key of ["value", "budget", "project_hours"]) if (body[key] != null && body[key] !== "" && (!Number.isFinite(Number(body[key])) || Number(body[key]) < 0)) return NextResponse.json({ error: `O campo ${key} deve ser um número não negativo.` }, { status: 400 });
  if (!currencies.includes(String(body.currency)) || (body.budget_currency && !currencies.includes(String(body.budget_currency)))) return NextResponse.json({ error: "Moeda inválida." }, { status: 400 });
  try {
    const keys = fields.filter((key) => body[key] !== undefined), values = keys.map((key) => body[key] === "" ? null : body[key]);
    const result = await pool.query(`UPDATE opportunities o SET ${keys.map((key, i) => `${key}=$${i + 1}`).join(",")}, updated_at=NOW() WHERE o.id=$${keys.length + 1} AND EXISTS(SELECT 1 FROM clients c WHERE c.id=$${keys.indexOf("client_id") + 1} AND c.is_active) AND EXISTS(SELECT 1 FROM contacts p WHERE p.id=$${keys.indexOf("contact_id") + 1} AND p.client_id=$${keys.indexOf("client_id") + 1}) RETURNING o.*`, [...values, id]);
    if (!result.rowCount) return NextResponse.json({ error: "Oportunidade ou associação válida não encontrada." }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch { return NextResponse.json({ error: "Não foi possível atualizar a oportunidade." }, { status: 400 }); }
}
