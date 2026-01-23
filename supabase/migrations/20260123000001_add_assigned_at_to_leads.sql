-- Add assigned_at column to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;

-- Create index for better query performance on assigned_at
CREATE INDEX IF NOT EXISTS idx_leads_assigned_at ON public.leads(assigned_at);
