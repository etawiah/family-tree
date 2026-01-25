-- Initialize the Family Tree database schema for Cloudflare D1.
-- Each table includes descriptive comments for clarity and future maintenance.

-- People table stores the core person records displayed in the family tree.
CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY,
  -- Indicates maternal or paternal side of the tree.
  tree_side TEXT NOT NULL,
  -- Legal first name.
  first_name TEXT NOT NULL,
  -- Middle name (optional).
  middle_name TEXT,
  -- Legal last name.
  last_name TEXT NOT NULL,
  -- Birth date stored as text for flexibility (YYYY-MM-DD recommended).
  birth_date TEXT,
  -- Death date stored as text for flexibility (YYYY-MM-DD recommended).
  death_date TEXT,
  -- Whether the person is currently alive.
  is_alive BOOLEAN NOT NULL,
  -- Current city/state/country if known.
  current_location TEXT,
  -- Occupation or profession if known.
  profession TEXT,
  -- Free-form notes for biographies and stories.
  personal_notes TEXT,
  -- URL to the primary headshot image (R2 or public URL).
  headshot_url TEXT,
  -- URL to an additional photo (optional).
  additional_photo_url TEXT,
  -- Gender identity selection for the UI.
  gender TEXT NOT NULL,
  -- Record creation timestamp (ISO 8601).
  created_at TEXT NOT NULL,
  -- Record update timestamp (ISO 8601).
  updated_at TEXT NOT NULL
);

-- Relationships table links people together with relationship metadata.
CREATE TABLE IF NOT EXISTS relationships (
  id INTEGER PRIMARY KEY,
  -- Indicates maternal or paternal side of the tree.
  tree_side TEXT NOT NULL,
  -- The primary person in the relationship.
  person_id INTEGER NOT NULL,
  -- The related person (parent, child, spouse, etc).
  related_person_id INTEGER NOT NULL,
  -- Relationship type used to interpret the link.
  relationship_type TEXT NOT NULL,
  -- Indicates whether the relationship is blood-related.
  is_blood_relation BOOLEAN NOT NULL,
  -- Marriage date for spouse relationships (optional).
  marriage_date TEXT,
  -- Divorce date for spouse relationships (optional).
  divorce_date TEXT,
  -- Used to order multiple spouse relationships.
  relationship_order INTEGER,
  -- Record creation timestamp (ISO 8601).
  created_at TEXT NOT NULL,
  FOREIGN KEY (person_id) REFERENCES people(id),
  FOREIGN KEY (related_person_id) REFERENCES people(id)
);

-- Users table stores login and access data for the app.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  -- Unique username for authentication.
  username TEXT NOT NULL UNIQUE,
  -- Hashed password (never store plaintext passwords).
  password_hash TEXT NOT NULL,
  -- Access level controls permissions in the UI.
  access_level TEXT NOT NULL,
  -- Record creation timestamp (ISO 8601).
  created_at TEXT NOT NULL
);

-- Snapshots table stores backups of the entire dataset.
CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY,
  -- JSON payload representing a snapshot of all tables.
  snapshot_data TEXT NOT NULL,
  -- Record creation timestamp (ISO 8601).
  created_at TEXT NOT NULL,
  -- Indicates whether the snapshot was automatic or user-initiated.
  created_by TEXT NOT NULL
);

-- Indexes improve lookup performance for the most common queries.
-- Index on tree_side speeds up filtering by maternal/paternal views.
CREATE INDEX IF NOT EXISTS idx_people_tree_side ON people (tree_side);

-- Indexes on relationship lookups speed up graph traversals.
CREATE INDEX IF NOT EXISTS idx_relationships_tree_side ON relationships (tree_side);
CREATE INDEX IF NOT EXISTS idx_relationships_person_id ON relationships (person_id);
CREATE INDEX IF NOT EXISTS idx_relationships_related_person_id ON relationships (related_person_id);
