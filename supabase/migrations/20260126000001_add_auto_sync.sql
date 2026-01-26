-- Add columns for sync tracking
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS last_data_sync timestamptz,
ADD COLUMN IF NOT EXISTS preferred_product text;

-- Create index for faster stale-lead lookups
CREATE INDEX IF NOT EXISTS leads_last_data_sync_idx ON public.leads (last_data_sync);

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper function to invoke the Edge Function
CREATE OR REPLACE FUNCTION public.invoke_sync_player_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Replace with your actual project URL and service key locally or rely on envs in Supabase
  project_url text := 'http://kong:8000'; -- Internal Kong URL for Supabase
  service_key text := 'YOUR_SERVICE_ROLE_KEY';
  request_id int;
BEGIN
  -- We prefer using the internal network for cron jobs if possible, or public URL
  -- For local dev, we often mock this or use mapped ports.
  -- In production, use the proper project URL.
  
  select net.http_post(
    url := 'https://hahkgifqajdnhvkbzwfx.supabase.co/functions/v1/sync-player-data', 
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key -- Ensure simple text concatenation
    )
  ) into request_id;
END;
$$;

-- Schedule the job to run EVERY HOUR (at minute 0)
-- This ensures that we process leads in batches continuously throughout the day.
SELECT cron.schedule(
  'sync-player-data-hourly',
  '0 * * * *', 
  'SELECT public.invoke_sync_player_data()'
);
