-- Run once on existing DBs to add access_log. New setups get it via d1-schema.sql.
CREATE TABLE IF NOT EXISTS access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT,
  country TEXT,
  user_agent TEXT,
  referer TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
