import { pool } from "@/lib/db";

const fields = ["name", "client_id", "contact_id", "technology", "value", "currency", "service_type", "resources", "budget", "budget_currency", "notes", "customer_need", "offered_solution", "project_hours", "opened_at", "expected_close_at", "status", "loss_reason"];

export async function listOpportunities(query: string | null, clientId: string | null, status: string | null) {
  const { rows } = await pool.query(`SELECT o.*, c.company_name, p.full_name AS contact_name FROM opportunities o JOIN clients c ON c.id=o.client_id JOIN contacts p ON p.id=o.contact_id AND p.client_id=o.client_id
    WHERE ($1::text IS NULL OR o.name ILIKE '%'||$1||'%' OR c.company_name ILIKE '%'||$1||'%' OR p.full_name ILIKE '%'||$1||'%') AND ($2::uuid IS NULL OR o.client_id=$2) AND ($3::text IS NULL OR o.status=$3) ORDER BY o.created_at DESC`, [query, clientId, status]);
  return rows;
}

export async function createOpportunity(body: Record<string, unknown>) {
  const columns = fields.filter((field) => body[field] !== undefined);
  const values = columns.map((field) => body[field] === "" ? null : body[field]);
  return pool.query(`INSERT INTO opportunities (${columns.join(",")}) SELECT ${columns.map((_, i) => `$${i + 1}`).join(",")} WHERE EXISTS (SELECT 1 FROM clients c WHERE c.id=$${columns.indexOf("client_id") + 1} AND c.is_active) AND EXISTS (SELECT 1 FROM contacts p WHERE p.id=$${columns.indexOf("contact_id") + 1} AND p.client_id=$${columns.indexOf("client_id") + 1}) RETURNING *`, values);
}

export async function changeOpportunityStatus(id: string, status: string, reason: string | null) {
  return pool.query("UPDATE opportunities SET status=$2, loss_reason=$3, updated_at=NOW() WHERE id=$1 RETURNING id", [id, status, reason]);
}

export async function updateOpportunity(id: string, body: Record<string, unknown>) {
  const keys = fields.filter((key) => body[key] !== undefined);
  const values = keys.map((key) => body[key] === "" ? null : body[key]);
  return pool.query(`UPDATE opportunities o SET ${keys.map((key, i) => `${key}=$${i + 1}`).join(",")}, updated_at=NOW() WHERE o.id=$${keys.length + 1} AND EXISTS(SELECT 1 FROM clients c WHERE c.id=$${keys.indexOf("client_id") + 1} AND c.is_active) AND EXISTS(SELECT 1 FROM contacts p WHERE p.id=$${keys.indexOf("contact_id") + 1} AND p.client_id=$${keys.indexOf("client_id") + 1}) RETURNING o.*`, [...values, id]);
}
