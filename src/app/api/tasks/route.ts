import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { saoPauloDayRange } from "@/lib/task-date.mjs";
import { validateTask } from "@/lib/task-validation.mjs";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const day = params.get("date") || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const { start, end } = saoPauloDayRange(day);
    const status = params.get("status");
    if (status && !["Aberto", "Concluído"].includes(status)) return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    const result = await pool.query(`SELECT t.id,t.contact_type,t.subject,t.description,t.scheduled_at,t.status,t.client_id,t.contact_id,c.company_name,p.full_name AS contact_name FROM tasks t JOIN clients c ON c.id=t.client_id JOIN contacts p ON p.id=t.contact_id AND p.client_id=t.client_id WHERE t.scheduled_at >= $1::timestamptz AND t.scheduled_at < $2::timestamptz AND ($3::text IS NULL OR t.status=$3) ORDER BY t.scheduled_at`, [start, end, status]);
    return NextResponse.json(result.rows);
  } catch { return NextResponse.json({ error: "Não foi possível carregar as tarefas." }, { status: 400 }); }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const error = validateTask(body); if (error) return NextResponse.json({ error }, { status: 400 });
  try {
    const result = await pool.query(`INSERT INTO tasks (contact_type,subject,description,scheduled_at,client_id,contact_id) SELECT $1,$2,$3,$4,$5,$6 WHERE EXISTS (SELECT 1 FROM clients WHERE id=$5 AND is_active) AND EXISTS (SELECT 1 FROM contacts WHERE id=$6 AND client_id=$5) RETURNING *`, [body.contact_type, (body.subject as string).trim(), body.description || null, body.scheduled_at, body.client_id, body.contact_id]);
    if (!result.rowCount) return NextResponse.json({ error: "Cliente ativo ou contato válido não encontrado." }, { status: 400 });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch { return NextResponse.json({ error: "Não foi possível cadastrar a tarefa." }, { status: 400 }); }
}
