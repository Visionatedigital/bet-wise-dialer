-- First, add the file_type column if it doesn't exist
ALTER TABLE public.generated_reports 
ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'docx';

-- Update existing records to have default file_type
UPDATE public.generated_reports 
SET file_type = 'docx' 
WHERE file_type IS NULL;

-- Drop the old constraint if it exists
ALTER TABLE public.generated_reports 
DROP CONSTRAINT IF EXISTS generated_reports_file_type_check;

-- Add the new constraint that includes 'csv'
ALTER TABLE public.generated_reports 
ADD CONSTRAINT generated_reports_file_type_check 
CHECK (file_type IN ('docx', 'xlsx', 'pdf', 'csv'));
