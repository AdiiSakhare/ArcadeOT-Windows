-- ArcadeOT2 local schema; use a separate database from v1.
PRAGMA synchronous=FULL;
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY);
INSERT OR IGNORE INTO schema_version VALUES(2);
CREATE TABLE IF NOT EXISTS measurements(
sequence INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT NOT NULL UNIQUE,
observed_utc TEXT NOT NULL,payload TEXT NOT NULL,acknowledged INTEGER NOT NULL DEFAULT 0,
quarantine_reason TEXT);
CREATE INDEX IF NOT EXISTS ix_outbox ON measurements(acknowledged,quarantine_reason,sequence);
CREATE TABLE IF NOT EXISTS configurations(
sequence INTEGER PRIMARY KEY AUTOINCREMENT,revision TEXT NOT NULL UNIQUE,
saved_utc TEXT NOT NULL,payload TEXT NOT NULL);
