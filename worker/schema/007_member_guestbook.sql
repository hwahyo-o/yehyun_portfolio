-- One-time migration: remove password-based guestbook ownership and preserve legacy messages.
-- Run only through the explicitly confirmed GitHub Actions workflow.
PRAGMA foreign_keys = OFF;
BEGIN;

CREATE TABLE guestbook_comments_member (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  author_uid TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

INSERT INTO guestbook_comments_member (id, name, author_uid, content, created_at, deleted_at)
SELECT id, name, NULL, content, created_at, deleted_at FROM guestbook_comments;

CREATE TABLE guestbook_replies_member (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL REFERENCES guestbook_comments_member(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  author_type TEXT NOT NULL DEFAULT 'visitor',
  author_name TEXT NOT NULL DEFAULT ''
);

INSERT INTO guestbook_replies_member (id, comment_id, content, created_at, deleted_at, author_type, author_name)
SELECT id, comment_id, content, created_at, deleted_at, author_type, author_name FROM guestbook_replies;

DROP TABLE guestbook_replies;
DROP TABLE guestbook_comments;
ALTER TABLE guestbook_comments_member RENAME TO guestbook_comments;
ALTER TABLE guestbook_replies_member RENAME TO guestbook_replies;
CREATE INDEX idx_guestbook_created ON guestbook_comments(created_at DESC);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at ASC);
ALTER TABLE conversations ADD COLUMN owner_uid TEXT;

COMMIT;
PRAGMA foreign_keys = ON;
