-- Add last_contact_at timestamp column to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS last_contact_at timestamp with time zone DEFAULT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_last_contact_at ON public.leads(last_contact_at DESC);

-- Update existing leads with last_contact_at from call_activities
UPDATE public.leads l
SET last_contact_at = (
  SELECT MAX(ca.start_time)
  FROM public.call_activities ca
  WHERE ca.phone_number = l.phone
)
WHERE EXISTS (
  SELECT 1 
  FROM public.call_activities ca 
  WHERE ca.phone_number = l.phone
);