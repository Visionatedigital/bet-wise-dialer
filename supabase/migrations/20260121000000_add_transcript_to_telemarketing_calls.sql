-- Add transcript column to telemarketing_calls table for storing call transcriptions
ALTER TABLE public.telemarketing_calls 
ADD COLUMN IF NOT EXISTS transcript TEXT;

-- Add language column to track detected/specified language
ALTER TABLE public.telemarketing_calls 
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- Add index for searching transcripts
CREATE INDEX IF NOT EXISTS idx_telemarketing_calls_transcript 
ON public.telemarketing_calls USING gin(to_tsvector('english', transcript));

-- Add comments for documentation
COMMENT ON COLUMN public.telemarketing_calls.transcript IS 'Full conversation transcript from speech-to-text service';
COMMENT ON COLUMN public.telemarketing_calls.language IS 'Detected or specified language code (en, sw, lg, nyn)';
