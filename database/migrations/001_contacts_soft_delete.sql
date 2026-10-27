-- @applied-if: SELECT 1 FROM pragma_table_info('contacts') WHERE name = 'is_active'
-- Preserva o contato e seu histórico quando ele é desativado (soft delete).
ALTER TABLE contacts ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));
