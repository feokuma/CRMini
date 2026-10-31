-- @applied-if: SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_settings'
-- Preferências do aplicativo em pares chave/valor (por exemplo, o nome do usuário).
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
