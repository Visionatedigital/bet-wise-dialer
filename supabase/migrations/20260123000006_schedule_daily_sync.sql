-- Enable the pg_cron extension to schedule recurring jobs
create extension if not exists pg_cron;

-- Enable pg_net to make HTTP requests from SQL
create extension if not exists pg_net;

-- Schedule the daily sync job (runs every day at 3:00 AM)
-- Adjust the PROJECT_REF and SERVICE_KEY with your actual values if running manually.
-- But since this runs Inside Supabase, we can use the internal API URL or the public one.
-- Best practice: Invoke the Edge Function using pg_net.

-- Note: You need to replace 'YOUR_PROJECT_REF' and 'YOUR_SERVICE_ROLE_KEY' 
-- if running this from SQL Editor manually, OR rely on internal headers if configured.

-- Let's create a wrapper function to make it easier to manage credentials
CREATE OR REPLACE FUNCTION public.invoke_fetch_player_deposits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_url text := 'https://hahkgifqajdnhvkbzwfx.supabase.co'; -- Your Project URL
  service_key text := 'YOUR_SERVICE_ROLE_KEY'; -- You must paste your SERVICE_KEY here
  request_id int;
BEGIN
  -- Perform the HTTP POST request to the Edge Function
  select net.http_post(
    url := project_url || '/functions/v1/fetch-player-deposits',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    )
  ) into request_id;
END;
$$;

-- Schedule the job
select cron.schedule(
  'fetch-player-deposits-daily', -- job name
  '0 3 * * *',                   -- schedule (3:00 AM daily)
  'select public.invoke_fetch_player_deposits()'
);
