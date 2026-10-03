ALTER TABLE classes ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS classes_active_year_idx ON classes (school_id, school_year_id) WHERE NOT archived;

