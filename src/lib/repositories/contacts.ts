import { pool } from "@/lib/db";

export async function listContacts(query: string | null, industry: string | null) {
  const { rows } = await pool.query(
    `SELECT p.id, p.full_name, p.job_title, p.email, p.phone, p.mobile,
      p.birthday, p.linkedin_url, p.notes, p.is_primary, p.client_id,
      c.company_name, c.trade_name, c.industry, c.logo_path
     FROM contacts p JOIN clients c ON c.id = p.client_id
     WHERE ($1::text IS NULL OR p.full_name ILIKE '%' || $1 || '%'
       OR p.email ILIKE '%' || $1 || '%' OR p.job_title ILIKE '%' || $1 || '%'
       OR p.phone ILIKE '%' || $1 || '%' OR p.mobile ILIKE '%' || $1 || '%'
       OR c.company_name ILIKE '%' || $1 || '%' OR c.trade_name ILIKE '%' || $1 || '%')
       AND ($2::text IS NULL OR c.industry = $2)
     ORDER BY c.company_name, p.is_primary DESC, p.full_name`, [query, industry]);
  return rows;
}
