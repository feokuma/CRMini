import { getDb } from "@/lib/db";
import { randomUUID } from "node:crypto";

export async function createContact(input: Record<string, any>) {
  const result = getDb()
    .prepare(
      `INSERT INTO contacts (id, client_id, full_name, job_title, email, phone, mobile, birthday, linkedin_url, notes, is_primary)
       SELECT @id, c.id, @full_name, @job_title, @email, @phone, @mobile, @birthday, @linkedin_url, @notes, @is_primary
       FROM clients c WHERE c.id = @client_id AND c.is_active = 1
       RETURNING *`,
    )
    .get({
      id: randomUUID(), client_id: input.client_id, full_name: input.full_name.trim(),
      job_title: input.job_title || null, email: input.email || null,
      phone: input.phone || null, mobile: input.mobile || null,
      birthday: input.birthday || null, linkedin_url: input.linkedin_url || null,
      notes: input.notes || null, is_primary: input.is_primary ? 1 : 0,
    });
  return result;
}

export async function getContact(id: string): Promise<Record<string, any> | undefined> {
  const row = getDb().prepare(
    `SELECT p.*, c.company_name, c.trade_name, c.industry
     FROM contacts p JOIN clients c ON c.id = p.client_id WHERE p.id = @id`,
  ).get({ id }) as Record<string, any> | undefined;
  return row ? { ...row, is_primary: Boolean(row.is_primary), is_active: Boolean(row.is_active) } : undefined;
}

async function setContactActive(id: string, isActive: boolean): Promise<boolean> {
  const db = getDb();
  const result = db.prepare("UPDATE contacts SET is_active = @active, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = @id").run({ id, active: isActive ? 1 : 0 });
  return result.changes > 0 || Boolean(db.prepare("SELECT 1 FROM contacts WHERE id = ?").get(id));
}
export const deactivateContact = (id: string) => setContactActive(id, false);
export const reactivateContact = (id: string) => setContactActive(id, true);

export async function updateContact(id: string, input: Record<string, any>) {
  const result = getDb().prepare(
    `UPDATE contacts SET full_name = @full_name, job_title = @job_title,
     email = @email, phone = @phone, mobile = @mobile, birthday = @birthday,
     linkedin_url = @linkedin_url, notes = @notes, is_primary = @is_primary,
     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = @id`,
  ).run({
    id, full_name: input.full_name.trim(), job_title: input.job_title || null,
    email: input.email || null, phone: input.phone || null, mobile: input.mobile || null,
    birthday: input.birthday || null, linkedin_url: input.linkedin_url || null,
    notes: input.notes || null, is_primary: input.is_primary ? 1 : 0,
  });
  return result.changes ? getContact(id) : undefined;
}

export async function listContacts(
  query: string | null,
  industry: string | null,
  includeInactive = false,
): Promise<Record<string, any>[]> {
  const rows = getDb()
    .prepare(
      `SELECT p.id, p.full_name, p.job_title, p.email, p.phone, p.mobile,
        p.birthday, p.linkedin_url, p.notes, p.is_primary, p.is_active, p.client_id,
        c.company_name, c.trade_name, c.industry, c.logo_path
       FROM contacts p JOIN clients c ON c.id = p.client_id
       WHERE (@include_inactive = 1 OR p.is_active = 1)
         AND (@query IS NULL OR normalize(p.full_name) LIKE '%' || normalize(@query) || '%'
         OR normalize(p.email) LIKE '%' || normalize(@query) || '%' OR normalize(p.job_title) LIKE '%' || normalize(@query) || '%'
         OR normalize(p.phone) LIKE '%' || normalize(@query) || '%' OR normalize(p.mobile) LIKE '%' || normalize(@query) || '%'
         OR (phone_digits(@query) <> ''
           AND (phone_digits(p.phone) LIKE '%' || phone_digits(@query) || '%'
             OR phone_digits(p.mobile) LIKE '%' || phone_digits(@query) || '%'))
         OR normalize(c.company_name) LIKE '%' || normalize(@query) || '%' OR normalize(c.trade_name) LIKE '%' || normalize(@query) || '%')
         AND (@industry IS NULL OR c.industry = @industry)
       ORDER BY c.company_name, p.is_primary DESC, p.full_name`,
    )
    .all({ query, industry, include_inactive: includeInactive ? 1 : 0 }) as Record<string, any>[];
  return rows.map((row) => ({ ...row, is_primary: Boolean(row.is_primary), is_active: Boolean(row.is_active) }));
}
