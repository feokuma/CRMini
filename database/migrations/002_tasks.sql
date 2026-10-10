CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_type TEXT NOT NULL CHECK (contact_type IN ('email','telefone','compromisso')),
  subject TEXT NOT NULL CHECK (length(trim(subject)) > 0),
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'Aberto' CHECK (status IN ('Aberto','Concluído')),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  contact_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT task_contact_client_fk FOREIGN KEY (contact_id, client_id) REFERENCES contacts(id, client_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS tasks_scheduled_at_idx ON tasks(scheduled_at);
CREATE INDEX IF NOT EXISTS tasks_client_id_idx ON tasks(client_id);
