-- Add columns to store personalized scripts and betting habits in leads table
ALTER TABLE public.telemarketing_leads 
ADD COLUMN IF NOT EXISTS personalized_script JSONB;

ALTER TABLE public.telemarketing_leads 
ADD COLUMN IF NOT EXISTS betting_habits JSONB;

-- Add index for faster script retrieval
CREATE INDEX IF NOT EXISTS idx_telemarketing_leads_script 
ON public.telemarketing_leads (id) 
WHERE personalized_script IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.telemarketing_leads.personalized_script IS 'AI-generated personalized call script based on customer betting habits';
COMMENT ON COLUMN public.telemarketing_leads.betting_habits IS 'Quick reference to customer betting preferences (favorite sports, teams, games)';
