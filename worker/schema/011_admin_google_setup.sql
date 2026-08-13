-- One-time unified Google Provider and Drive setup state.
-- The Firebase ID token is encrypted with a Worker secret and removed after callback.

CREATE TABLE IF NOT EXISTS admin_google_setup_states (
  state TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  session_id TEXT NOT NULL,
  firebase_id_token_ciphertext TEXT NOT NULL,
  firebase_id_token_iv TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_google_setup_states_created_at
  ON admin_google_setup_states(created_at);
