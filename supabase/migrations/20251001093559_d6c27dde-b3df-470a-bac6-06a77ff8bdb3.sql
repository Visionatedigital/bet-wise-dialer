-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily cleanup of old call recordings (runs at 2 AM UTC every day)
SELECT cron.schedule(
  'cleanup-old-recordings-daily',
  '0 2 * * *', -- At 2:00 AM every day
  $$
  SELECT
    net.http_post(
        url:='https://hahkgifqajdnhvkbzwfx.supabase.co/functions/v1/cleanup-old-recordings',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhaGtnaWZxYWpkbmh2a2J6d2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNTE5MzIsImV4cCI6MjA3NDcyNzkzMn0.iLCXA3OSkvbbQzfSp9ir_beIUlXZQY6g6goN88oighQ"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Add comment for documentation
COMMENT ON EXTENSION pg_cron IS 'Used for scheduling automatic cleanup of call recordings older than 30 days';