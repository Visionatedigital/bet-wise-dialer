-- Add transcript field to call_activities table
-- Run this SQL in Supabase Dashboard -> SQL Editor

ALTER TABLE public.call_activities 
ADD COLUMN IF NOT EXISTS transcript TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.call_activities.transcript IS 'Full conversation transcript captured during the call (real-time speech-to-text)';
