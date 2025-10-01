-- Add recording_url field to call_activities table
ALTER TABLE public.call_activities 
ADD COLUMN recording_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.call_activities.recording_url IS 'URL to the stored recording of the call';