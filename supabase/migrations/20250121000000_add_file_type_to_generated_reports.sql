-- Add file_type column to generated_reports table
ALTER TABLE public.generated_reports 
ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'docx' CHECK (file_type IN ('docx', 'xlsx', 'pdf'));

-- Update existing records to have default file_type
UPDATE public.generated_reports 
SET file_type = 'docx' 
WHERE file_type IS NULL;

