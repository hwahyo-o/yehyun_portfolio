-- One-time migration for Firebase Authentication Google Provider login state.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS firebase_google_login_states (
  state TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_firebase_google_login_states_created
  ON firebase_google_login_states(created_at);
