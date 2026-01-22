-- Add transcript field to call_activities table
ALTER TABLE public.call_activities 
ADD COLUMN transcript TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.call_activities.transcript IS 'Full conversation transcript captured during the call (real-time speech-to-text)';
