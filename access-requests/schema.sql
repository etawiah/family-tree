-- Access-request records. Denied rows are deleted immediately.
-- Approved rows are deleted after 30 days by the Worker cron. IPs are never stored.
CREATE TABLE IF NOT EXISTS access_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved')),
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_access_requests_email
  ON access_requests (email);
