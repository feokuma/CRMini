-- Preserva o contato e seu histórico quando ele é desativado (soft delete).
ALTER TABLE contacts ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));
