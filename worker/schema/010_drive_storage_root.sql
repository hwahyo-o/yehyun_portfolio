-- Verified Google Drive root used for portfolio source assets.
-- The folder id is private metadata; OAuth tokens remain in google_drive_connections.

CREATE TABLE IF NOT EXISTS drive_storage_roots (
  id TEXT PRIMARY KEY,
  drive_folder_id TEXT NOT NULL,
  verified_at TEXT NOT NULL
);
