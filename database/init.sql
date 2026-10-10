CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  trade_name TEXT,
  tax_id TEXT,
  industry TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  postal_code TEXT,
  street TEXT,
  street_number TEXT,
  complement TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Brasil',
  notes TEXT,
  logo_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  job_title TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  birthday DATE,
  linkedin_url TEXT,
  notes TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contacts_client_id_idx ON contacts(client_id);
CREATE INDEX IF NOT EXISTS clients_company_name_idx ON clients(company_name);
