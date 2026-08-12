-- Additive migration for Firebase member and anonymous visitor sessions.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS visitor_sessions (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  email TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('anonymous', 'password', 'google')),
  refresh_token_ciphertext TEXT NOT NULL,
  refresh_token_iv TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_uid
  ON visitor_sessions(uid);
