-- Add trait column to leads table if not already present
ALTER TABLE leads ADD COLUMN IF NOT EXISTS trait TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS country TEXT;
