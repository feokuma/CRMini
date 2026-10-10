import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await pool.query(`SELECT c.*, COALESCE(json_agg(to_jsonb(p)) FILTER (WHERE p.id IS NOT NULL), '[]') AS contacts
      FROM clients c LEFT JOIN contacts p ON p.client_id=c.id WHERE c.id=$1 GROUP BY c.id`, [id]);
    if (!result.rowCount) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch { return NextResponse.json({ error: "Erro ao consultar cliente." }, { status: 503 }); }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  if (!body.company_name?.trim()) return NextResponse.json({ error: "Informe o nome da empresa." }, { status: 400 });
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await db.query(`UPDATE clients SET company_name=$2, trade_name=$3, tax_id=$4, industry=$5,
      website=$6, phone=$7, email=$8, postal_code=$9, street=$10, street_number=$11, complement=$12,
      city=$13, state=$14, country=$15, notes=$16, logo_path=$17, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id, body.company_name.trim(), body.trade_name, body.tax_id, body.industry, body.website,
       body.phone, body.email, body.postal_code, body.street, body.street_number, body.complement,
       body.city, body.state, body.country || "Brasil", body.notes, body.logo_path]);
    if (!result.rowCount) { await db.query("ROLLBACK"); return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 }); }
    await db.query("DELETE FROM contacts WHERE client_id=$1", [id]);
    for (const contact of body.contacts || []) {
      if (!contact.full_name?.trim()) continue;
      await db.query(`INSERT INTO contacts (client_id,full_name,job_title,email,phone,mobile,birthday,linkedin_url,notes,is_primary)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [id, contact.full_name.trim(), contact.job_title, contact.email, contact.phone, contact.mobile,
         contact.birthday || null, contact.linkedin_url, contact.notes, Boolean(contact.is_primary)]);
    }
    await db.query("COMMIT");
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    await db.query("ROLLBACK"); console.error("Failed to update client", error);
    return NextResponse.json({ error: "Não foi possível atualizar o cliente." }, { status: 500 });
  } finally { db.release(); }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await pool.query("DELETE FROM clients WHERE id=$1", [id]);
    if (!result.rowCount) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch { return NextResponse.json({ error: "Não foi possível excluir o cliente." }, { status: 500 }); }
}
