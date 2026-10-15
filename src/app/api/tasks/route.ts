import { NextRequest, NextResponse } from "next/server";
import { createTask, listTasks } from "@/lib/repositories/tasks";
import { saoPauloDayRange } from "@/lib/task-date";
import { validateTask } from "@/lib/task-validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const day = params.get("date");
    const range = day ? saoPauloDayRange(day) : null;
    const status = params.get("status");
    if (status && !["Aberto", "Concluído"].includes(status))
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    return NextResponse.json(
      await listTasks(range?.start ?? null, range?.end ?? null, status),
    );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar as tarefas." },
      { status: 400 },
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
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const error = validateTask(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  try {
    const result = await createTask(body);
    if (!result.rowCount)
      return NextResponse.json(
        { error: "Cliente ativo ou contato válido não encontrado." },
        { status: 400 },
      );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível cadastrar a tarefa." },
      { status: 400 },
    );
  }
}
