-- Mirrors implemented Store DDL. PRAGMAs are connection/database settings.
PRAGMA journal_mode=WAL;
PRAGMA synchronous=FULL;
CREATE TABLE IF NOT EXISTS measurements (
 event_id TEXT PRIMARY KEY,
 observed_utc TEXT NOT NULL,
 payload TEXT NOT NULL,
 acknowledged INTEGER NOT NULL DEFAULT 0 CHECK(acknowledged IN (0,1))
);
CREATE INDEX IF NOT EXISTS ix_pending ON measurements(acknowledged,observed_utc);
