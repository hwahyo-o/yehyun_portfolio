-- One-time Google provider linking states for an authenticated administrator session.
-- Values are opaque state/session hashes; do not place user identifiers or secrets in this file.

CREATE TABLE IF NOT EXISTS firebase_google_link_states (
  state TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_firebase_google_link_states_created_at
  ON firebase_google_link_states(created_at);
