-- Migration to add 'trait' column to leads table

ALTER TABLE leads 
ADD COLUMN trait TEXT;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads' AND column_name = 'trait';
