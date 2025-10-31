-- Add manager_id to profiles table to track agent assignments
ALTER TABLE public.profiles
ADD COLUMN manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_profiles_manager_id ON public.profiles(manager_id);

-- Update RLS policy for profiles to allow managers to see their assigned agents
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

CREATE POLICY "Users can view profiles" ON public.profiles
FOR SELECT USING (
  (approved = true) AND (
    (auth.uid() = id) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'management'::app_role) OR
    (manager_id = auth.uid())
  )
);

-- Update get_agent_monitor_data function to support manager filtering
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
    SELECT user_id, COUNT(*) AS assigned_leads
    FROM public.leads
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  ) lc ON lc.user_id = a.id
  ORDER BY a.full_name NULLS LAST, a.email NULLS LAST;
$$;

-- Update call_activities RLS to allow managers to see their agents' calls
DROP POLICY IF EXISTS "Users can view call activities" ON public.call_activities;

CREATE POLICY "Users can view call activities" ON public.call_activities
FOR SELECT USING (
  (auth.uid() = user_id) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'management'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = call_activities.user_id
    AND manager_id = auth.uid()
  )
);

-- Update daily_metrics RLS to allow managers to see their agents' metrics
DROP POLICY IF EXISTS "Users can view daily metrics" ON public.daily_metrics;

CREATE POLICY "Users can view daily metrics" ON public.daily_metrics
FOR SELECT USING (
  (auth.uid() = user_id) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'management'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = daily_metrics.user_id
    AND manager_id = auth.uid()
  )
);

-- Update leads RLS to allow managers to see leads assigned to their agents
DROP POLICY IF EXISTS "Admins can view all leads including unassigned" ON public.leads;

CREATE POLICY "Admins and managers can view leads" ON public.leads
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'management'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = leads.user_id
    AND manager_id = auth.uid()
  )
);