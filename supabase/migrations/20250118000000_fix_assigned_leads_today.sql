-- Fix get_agent_monitor_data to count only today's assigned leads, not all assigned leads
CREATE OR REPLACE FUNCTION public.get_agent_monitor_data(manager_filter uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  full_name text,
  email text,
  status text,
  current_call_start timestamp with time zone,
  last_status_change timestamp with time zone,
  calls_today integer,
  assigned_leads integer,
  last_campaign_name text,
  manager_id uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH agents AS (
    SELECT p.*
    FROM public.profiles p
    WHERE p.approved = true
      AND public.has_role(p.id, 'agent')
      AND (manager_filter IS NULL OR p.manager_id = manager_filter)
  )
  SELECT 
    a.id,
    a.full_name,
    a.email,
    a.status,
    a.current_call_start,
    a.last_status_change,
    COALESCE(ct.calls_today, 0) AS calls_today,
    COALESCE(lc.assigned_leads_today, 0) AS assigned_leads,
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
    ) AS last_campaign_name,
    a.manager_id
  FROM agents a
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS calls_today
    FROM public.call_activities 
    WHERE start_time::date = current_date
    GROUP BY user_id
  ) ct ON ct.user_id = a.id
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS assigned_leads_today
    FROM public.leads
    WHERE user_id IS NOT NULL
      AND assigned_at IS NOT NULL
      AND assigned_at::date = current_date
    GROUP BY user_id
  ) lc ON lc.user_id = a.id
  ORDER BY a.full_name NULLS LAST, a.email NULLS LAST;
$$;
