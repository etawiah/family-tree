PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE people (
  id INTEGER PRIMARY KEY,
  
  tree_side TEXT NOT NULL,
  
  first_name TEXT NOT NULL,
  
  middle_name TEXT,
  
  last_name TEXT NOT NULL,
  
  birth_date TEXT,
  
  death_date TEXT,
  
  is_alive BOOLEAN NOT NULL,
  
  current_location TEXT,
  
  profession TEXT,
  
  personal_notes TEXT,
  
  headshot_url TEXT,
  
  additional_photo_url TEXT,
  
  gender TEXT NOT NULL,
  
  is_deleted BOOLEAN NOT NULL DEFAULT 0,
  
  created_at TEXT NOT NULL,
  
  updated_at TEXT NOT NULL
);
CREATE TABLE relationships (
  id INTEGER PRIMARY KEY,
  
  tree_side TEXT NOT NULL,
  
  person_id INTEGER NOT NULL,
  
  related_person_id INTEGER NOT NULL,
  
  relationship_type TEXT NOT NULL,
  
  is_blood_relation BOOLEAN NOT NULL,
  
  marriage_date TEXT,
  
  divorce_date TEXT,
  
  relationship_order INTEGER,
  
  created_at TEXT NOT NULL,
  FOREIGN KEY (person_id) REFERENCES people(id),
  FOREIGN KEY (related_person_id) REFERENCES people(id)
);
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  
  username TEXT NOT NULL UNIQUE,
  
  password_hash TEXT NOT NULL,
  
  access_level TEXT NOT NULL,
  
  created_at TEXT NOT NULL
);
CREATE TABLE snapshots (
  id INTEGER PRIMARY KEY,
  
  snapshot_data TEXT NOT NULL,
  
  created_at TEXT NOT NULL,
  
  created_by TEXT NOT NULL
);
CREATE INDEX idx_people_tree_side ON people (tree_side);
CREATE INDEX idx_relationships_tree_side ON relationships (tree_side);
CREATE INDEX idx_relationships_person_id ON relationships (person_id);
CREATE INDEX idx_relationships_related_person_id ON relationships (related_person_id);