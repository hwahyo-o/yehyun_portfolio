-- Activity event ledger and Cloudflare backup snapshots.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS activity_events (
  event_id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'member', 'guest')),
  action TEXT NOT NULL,
  entity_id TEXT,
  result TEXT NOT NULL DEFAULT 'success',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_events_created
  ON activity_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_events_actor
  ON activity_events(actor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS activity_backup_runs (
  id TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  checksum TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_backup_runs_created
  ON activity_backup_runs(created_at DESC);
