ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS tag ENUM('prod', 'dry-run') NOT NULL DEFAULT 'prod';
