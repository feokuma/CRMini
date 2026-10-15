import { pool } from "@/lib/db";

export async function listTasks(
  start: string | null,
  end: string | null,
  status: string | null,
) {
  const { rows } = await pool.query(
    `SELECT t.id,t.contact_type,t.subject,t.description,t.scheduled_at,t.status,t.client_id,t.contact_id,c.company_name,p.full_name AS contact_name
    FROM tasks t JOIN clients c ON c.id=t.client_id JOIN contacts p ON p.id=t.contact_id AND p.client_id=t.client_id
    WHERE ($1::timestamptz IS NULL OR (t.scheduled_at >= $1::timestamptz AND t.scheduled_at < $2::timestamptz)) AND ($3::text IS NULL OR t.status=$3) ORDER BY t.scheduled_at`,
    [start, end, status],
  );
  return rows;
}

export async function createTask(body: Record<string, unknown>) {
  return pool.query(
    `INSERT INTO tasks (contact_type,subject,description,scheduled_at,client_id,contact_id)
    SELECT $1,$2,$3,$4,$5,$6 WHERE EXISTS (SELECT 1 FROM clients WHERE id=$5 AND is_active)
    AND EXISTS (SELECT 1 FROM contacts WHERE id=$6 AND client_id=$5) RETURNING *`,
    [
      body.contact_type,
      (body.subject as string).trim(),
      body.description || null,
      body.scheduled_at,
      body.client_id,
      body.contact_id,
    ],
  );
}

export async function updateTaskStatus(id: string, status: unknown) {
  return pool.query(
    "UPDATE tasks SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,status",
    [status, id],
  );
}
