-- Additive migration for server-managed administrator sessions.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  email TEXT,
  refresh_token_ciphertext TEXT NOT NULL,
  refresh_token_iv TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_uid
  ON admin_sessions(uid);
