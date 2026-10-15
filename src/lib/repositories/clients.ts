import { pool } from "@/lib/db";

export async function listClients(search: string | null) {
  const { rows } = await pool.query(
    `SELECT c.*, COALESCE(json_agg(json_build_object(
      'id', p.id, 'full_name', p.full_name, 'job_title', p.job_title,
      'email', p.email, 'phone', p.phone, 'mobile', p.mobile,
      'birthday', p.birthday, 'linkedin_url', p.linkedin_url,
      'notes', p.notes, 'is_primary', p.is_primary
    )) FILTER (WHERE p.id IS NOT NULL), '[]') AS contacts
    FROM clients c LEFT JOIN contacts p ON p.client_id = c.id
    WHERE ($1::text IS NULL OR c.company_name ILIKE '%' || $1 || '%' OR p.full_name ILIKE '%' || $1 || '%')
    GROUP BY c.id ORDER BY c.created_at DESC`,
    [search],
  );
  return rows;
}

export async function createClient(body: Record<string, any>) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const {
      rows: [client],
    } = await db.query(
      `INSERT INTO clients (company_name, trade_name, tax_id, industry, website, phone, email,
       postal_code, street, street_number, complement, city, state, country, notes, logo_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [
        body.company_name.trim(),
        body.trade_name,
        body.tax_id,
        body.industry,
        body.website,
        body.phone,
        body.email,
        body.postal_code,
        body.street,
        body.street_number,
        body.complement,
        body.city,
        body.state,
        body.country || "Brasil",
        body.notes,
        body.logo_path,
      ],
    );
    for (const contact of body.contacts || []) {
      if (!contact.full_name?.trim()) continue;
      await db.query(
        `INSERT INTO contacts (client_id, full_name, job_title, email, phone, mobile, birthday, linkedin_url, notes, is_primary)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          client.id,
          contact.full_name.trim(),
          contact.job_title,
          contact.email,
          contact.phone,
          contact.mobile,
          contact.birthday || null,
          contact.linkedin_url,
          contact.notes,
          Boolean(contact.is_primary),
        ],
      );
    }
    await db.query("COMMIT");
    return client;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

export async function getClient(id: string) {
  const { rows, rowCount } = await pool.query(
    `SELECT c.*, COALESCE(json_agg(to_jsonb(p)) FILTER (WHERE p.id IS NOT NULL), '[]') AS contacts
    FROM clients c LEFT JOIN contacts p ON p.client_id=c.id WHERE c.id=$1 GROUP BY c.id`,
    [id],
  );
  return { client: rows[0], found: Boolean(rowCount) };
}

export async function updateClient(id: string, body: Record<string, any>) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await db.query(
      `UPDATE clients SET company_name=$2, trade_name=$3, tax_id=$4, industry=$5,
      website=$6, phone=$7, email=$8, postal_code=$9, street=$10, street_number=$11, complement=$12,
      city=$13, state=$14, country=$15, notes=$16, logo_path=$17, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [
        id,
        body.company_name.trim(),
        body.trade_name,
        body.tax_id,
        body.industry,
        body.website,
        body.phone,
        body.email,
        body.postal_code,
        body.street,
        body.street_number,
        body.complement,
        body.city,
        body.state,
        body.country || "Brasil",
        body.notes,
        body.logo_path,
      ],
    );
    if (!result.rowCount) {
      await db.query("ROLLBACK");
      return null;
    }
    await db.query("DELETE FROM contacts WHERE client_id=$1", [id]);
    for (const contact of body.contacts || []) {
      if (!contact.full_name?.trim()) continue;
      await db.query(
        `INSERT INTO contacts (client_id,full_name,job_title,email,phone,mobile,birthday,linkedin_url,notes,is_primary)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          id,
          contact.full_name.trim(),
          contact.job_title,
          contact.email,
          contact.phone,
          contact.mobile,
          contact.birthday || null,
          contact.linkedin_url,
          contact.notes,
          Boolean(contact.is_primary),
        ],
      );
    }
    await db.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

export async function deactivateClient(id: string) {
  const { rows, rowCount } = await pool.query(
    "UPDATE clients SET is_active=FALSE, updated_at=NOW() WHERE id=$1 RETURNING id",
    [id],
  );
  return { found: Boolean(rowCount), row: rows[0] };
}
