import { getDb } from "@/lib/db";

export async function listContacts(
  query: string | null,
  industry: string | null,
): Promise<Record<string, any>[]> {
  const rows = getDb()
    .prepare(
      `SELECT p.id, p.full_name, p.job_title, p.email, p.phone, p.mobile,
        p.birthday, p.linkedin_url, p.notes, p.is_primary, p.client_id,
        c.company_name, c.trade_name, c.industry, c.logo_path
       FROM contacts p JOIN clients c ON c.id = p.client_id
       WHERE (@query IS NULL OR p.full_name LIKE '%' || @query || '%'
         OR p.email LIKE '%' || @query || '%' OR p.job_title LIKE '%' || @query || '%'
         OR p.phone LIKE '%' || @query || '%' OR p.mobile LIKE '%' || @query || '%'
         OR c.company_name LIKE '%' || @query || '%' OR c.trade_name LIKE '%' || @query || '%')
         AND (@industry IS NULL OR c.industry = @industry)
       ORDER BY c.company_name, p.is_primary DESC, p.full_name`,
    )
    .all({ query, industry }) as Record<string, any>[];
  return rows.map((row) => ({ ...row, is_primary: Boolean(row.is_primary) }));
}
