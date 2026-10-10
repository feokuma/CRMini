import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("q")?.trim();
    const result = await pool.query(
      `SELECT c.*, COALESCE(json_agg(json_build_object(
        'id', p.id, 'full_name', p.full_name, 'job_title', p.job_title,
        'email', p.email, 'phone', p.phone, 'mobile', p.mobile,
        'birthday', p.birthday, 'linkedin_url', p.linkedin_url,
        'notes', p.notes, 'is_primary', p.is_primary
      )) FILTER (WHERE p.id IS NOT NULL), '[]') AS contacts
      FROM clients c LEFT JOIN contacts p ON p.client_id = c.id
      WHERE ($1::text IS NULL OR c.company_name ILIKE '%' || $1 || '%' OR p.full_name ILIKE '%' || $1 || '%')
      GROUP BY c.id ORDER BY c.created_at DESC`, [search || null]);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Failed to list clients", error);
    return NextResponse.json({ error: "Não foi possível carregar os clientes." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.company_name?.trim()) return NextResponse.json({ error: "Informe o nome da empresa." }, { status: 400 });
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const clientResult = await db.query(
      `INSERT INTO clients (company_name, trade_name, tax_id, industry, website, phone, email,
       postal_code, street, street_number, complement, city, state, country, notes, logo_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [body.company_name.trim(), body.trade_name, body.tax_id, body.industry, body.website,
        body.phone, body.email, body.postal_code, body.street, body.street_number, body.complement,
        body.city, body.state, body.country || "Brasil", body.notes, body.logo_path]);
    const client = clientResult.rows[0];
    for (const contact of body.contacts || []) {
      if (!contact.full_name?.trim()) continue;
      await db.query(
        `INSERT INTO contacts (client_id, full_name, job_title, email, phone, mobile, birthday, linkedin_url, notes, is_primary)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [client.id, contact.full_name.trim(), contact.job_title, contact.email, contact.phone,
          contact.mobile, contact.birthday || null, contact.linkedin_url, contact.notes, Boolean(contact.is_primary)]);
    }
    await db.query("COMMIT");
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Failed to create client", error);
    return NextResponse.json({ error: "Não foi possível cadastrar o cliente." }, { status: 500 });
  } finally { db.release(); }
}
