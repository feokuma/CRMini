import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || null;
  const industry = request.nextUrl.searchParams.get("segment")?.trim() || null;
  try {
    const result = await pool.query(
      `SELECT p.id, p.full_name, p.job_title, p.email, p.phone, p.mobile,
        p.birthday, p.linkedin_url, p.notes, p.is_primary, p.client_id,
        c.company_name, c.trade_name, c.industry, c.logo_path
       FROM contacts p JOIN clients c ON c.id = p.client_id
       WHERE ($1::text IS NULL OR p.full_name ILIKE '%' || $1 || '%'
         OR p.email ILIKE '%' || $1 || '%' OR p.job_title ILIKE '%' || $1 || '%'
         OR p.phone ILIKE '%' || $1 || '%' OR p.mobile ILIKE '%' || $1 || '%'
         OR c.company_name ILIKE '%' || $1 || '%' OR c.trade_name ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR c.industry = $2)
       ORDER BY c.company_name, p.is_primary DESC, p.full_name`,
      [query, industry],
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Failed to list contacts", error);
    return NextResponse.json({ error: "Não foi possível carregar os contatos." }, { status: 503 });
  }
}
