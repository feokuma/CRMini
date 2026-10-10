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
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
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

CREATE UNIQUE INDEX IF NOT EXISTS contacts_id_client_id_uidx ON contacts(id, client_id);
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  contact_id UUID NOT NULL,
  technology TEXT,
  value NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency IN ('BRL','USD','EUR','PES')),
  service_type TEXT,
  resources TEXT,
  budget NUMERIC(14,2),
  budget_currency TEXT CHECK (budget_currency IS NULL OR budget_currency IN ('BRL','USD','EUR','PES')),
  notes TEXT,
  customer_need TEXT,
  offered_solution TEXT,
  project_hours NUMERIC(12,2),
  opened_at DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_close_at DATE,
  status TEXT NOT NULL DEFAULT 'Em andamento' CHECK (status IN ('Em andamento','Desenvolvimento','Proposta','Aceite da proposta','Ganha','Perdida')),
  loss_reason TEXT CHECK (loss_reason IS NULL OR loss_reason IN ('Preço','Prazo','Tecnologia','Solução')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT opportunity_contact_client_fk FOREIGN KEY (contact_id, client_id) REFERENCES contacts(id, client_id) ON DELETE RESTRICT,
  CONSTRAINT opportunity_loss_reason_check CHECK ((status = 'Perdida' AND loss_reason IS NOT NULL) OR (status <> 'Perdida' AND loss_reason IS NULL)),
  CONSTRAINT opportunity_nonnegative_values CHECK ((value IS NULL OR value >= 0) AND (budget IS NULL OR budget >= 0) AND (project_hours IS NULL OR project_hours >= 0))
);
CREATE INDEX IF NOT EXISTS opportunities_client_id_idx ON opportunities(client_id);
CREATE INDEX IF NOT EXISTS opportunities_status_idx ON opportunities(status);
