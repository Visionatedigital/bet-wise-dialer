-- Ensure last_status_change updates when status changes
DROP TRIGGER IF EXISTS trg_update_profile_status_timestamp ON public.profiles;
CREATE TRIGGER trg_update_profile_status_timestamp
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_status_timestamp();

-- Function to fetch agent-only monitor data for management/admin
CREATE OR REPLACE FUNCTION public.get_agent_monitor_data()
RETURNS TABLE(
  id uuid,
  full_name text,
  email text,
  status text,
  current_call_start timestamptz,
  last_status_change timestamptz,
  calls_today integer,
  assigned_leads integer,
  last_campaign_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agents AS (
    SELECT p.*
    FROM public.profiles p
    WHERE p.approved = true
      AND public.has_role(p.id, 'agent')
  )
  SELECT 
    a.id,
    a.full_name,
    a.email,
    a.status,
    a.current_call_start,
    a.last_status_change,
    COALESCE(ct.calls_today, 0) AS calls_today,
    COALESCE(lc.assigned_leads, 0) AS assigned_leads,
    COALESCE(
      (
        SELECT c.name 
        FROM public.call_activities ca 
        JOIN public.campaigns c ON c.id = ca.campaign_id
        WHERE ca.user_id = a.id AND ca.start_time::date = current_date
        ORDER BY ca.start_time DESC
        LIMIT 1
      ),
      'No Campaign'
    ) AS last_campaign_name
  FROM agents a
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS calls_today
    FROM public.call_activities 
    WHERE start_time::date = current_date
    GROUP BY user_id
  ) ct ON ct.user_id = a.id
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS assigned_leads
    FROM public.leads
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  ) lc ON lc.user_id = a.id
  ORDER BY a.full_name NULLS LAST, a.email NULLS LAST;
$$;