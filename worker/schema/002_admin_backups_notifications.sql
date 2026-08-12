-- Additive migration for administrator notifications and Drive backups.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('auto', 'manual')),
  file_name TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  drive_folder_id TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  restored_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_backups_created
  ON backups(created_at DESC);

CREATE TABLE IF NOT EXISTS admin_notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  entity_id TEXT,
  created_at TEXT NOT NULL,
  read_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created
  ON admin_notifications(created_at DESC);
