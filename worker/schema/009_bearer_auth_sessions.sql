-- Cookie-free opaque authentication sessions and one-time Google callback tickets.
-- Raw tokens are never stored in D1; session tokens and ticket payloads are hashed or encrypted.

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('member', 'admin')),
  refresh_token_ciphertext TEXT NOT NULL,
  refresh_token_iv TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_callback_tickets (
  id TEXT PRIMARY KEY,
  session_token_ciphertext TEXT NOT NULL,
  session_token_iv TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_callback_tickets_expires_at ON auth_callback_tickets(expires_at);
