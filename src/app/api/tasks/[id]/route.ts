import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
export const runtime = "nodejs";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let body: { status?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 }); }
  if (!body || !["Aberto", "Concluído"].includes(String(body.status))) return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  const { id } = await params;
  try {
    const result = await pool.query("UPDATE tasks SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,status", [body.status, id]);
    if (!result.rowCount) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch { return NextResponse.json({ error: "Não foi possível atualizar a tarefa." }, { status: 400 }); }
}
