-- Clear and create tree table. Run via: npm run d1:setup
DROP TABLE IF EXISTS tree;
CREATE TABLE tree (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Access log for password gate (run once on existing DBs: npm run d1:migrate)
CREATE TABLE IF NOT EXISTS access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT,
  country TEXT,
  user_agent TEXT,
  referer TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
