-- Clear and create tree table. Run via: npm run d1:setup
DROP TABLE IF EXISTS tree;
CREATE TABLE tree (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
