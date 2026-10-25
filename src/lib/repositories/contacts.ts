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
       WHERE (@query IS NULL OR normalize(p.full_name) LIKE '%' || normalize(@query) || '%'
         OR normalize(p.email) LIKE '%' || normalize(@query) || '%' OR normalize(p.job_title) LIKE '%' || normalize(@query) || '%'
         OR normalize(p.phone) LIKE '%' || normalize(@query) || '%' OR normalize(p.mobile) LIKE '%' || normalize(@query) || '%'
         OR normalize(c.company_name) LIKE '%' || normalize(@query) || '%' OR normalize(c.trade_name) LIKE '%' || normalize(@query) || '%')
         AND (@industry IS NULL OR c.industry = @industry)
       ORDER BY c.company_name, p.is_primary DESC, p.full_name`,
    )
    .all({ query, industry }) as Record<string, any>[];
  return rows.map((row) => ({ ...row, is_primary: Boolean(row.is_primary) }));
}
