-- Fix: Ensure agents only see leads assigned to them
-- This migration fixes the get_agent_uncalled_leads function to strictly filter by user_id
-- and also adds additional validation to prevent agents from seeing unassigned or other agents' leads

-- Drop and recreate the function with stricter filtering
DROP FUNCTION IF EXISTS public.get_agent_uncalled_leads(uuid);

CREATE OR REPLACE FUNCTION public.get_agent_uncalled_leads(agent_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  phone text,
  score integer,
  segment text,
  priority text,
  campaign text,
  campaign_id uuid,
  last_activity text,
  last_contact_at timestamp with time zone,
  next_action text,
  next_action_due timestamp with time zone,
  intent text,
  tags text[],
  last_bet_date date,
  last_deposit_ugx numeric,
  sla_minutes integer,
  user_id uuid,
  assigned_at timestamp with time zone,
  assigned_by uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate that agent_id is provided and not null
  IF agent_id IS NULL THEN
    RAISE EXCEPTION 'agent_id cannot be null';
  END IF;

  -- Return only leads that:
  -- 1. Are explicitly assigned to this agent (user_id = agent_id)
  -- 2. Have a non-null user_id (not unassigned)
  -- 3. Have not been called by this agent yet
  RETURN QUERY
  SELECT 
    l.id,
    l.name,
    l.phone,
    l.score,
    l.segment,
    l.priority,
    l.campaign,
    l.campaign_id,
    l.last_activity,
    l.last_contact_at,
    l.next_action,
    l.next_action_due,
    l.intent,
    l.tags,
    l.last_bet_date,
    l.last_deposit_ugx,
    l.sla_minutes,
    l.user_id,
    l.assigned_at,
    l.assigned_by,
    l.created_at,
    l.updated_at
  FROM leads l
  WHERE l.user_id = agent_id  -- STRICT: Only leads assigned to this agent
    AND l.user_id IS NOT NULL  -- STRICT: Exclude unassigned leads
    AND NOT EXISTS (
      SELECT 1 
      FROM call_activities ca 
      WHERE ca.user_id = agent_id 
        AND ca.phone_number = l.phone
    )
  ORDER BY 
    l.priority DESC,  -- High priority first
    l.assigned_at ASC,  -- Oldest assigned first
    l.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_agent_uncalled_leads(uuid) TO authenticated;

-- Add a comment explaining the function
COMMENT ON FUNCTION public.get_agent_uncalled_leads(uuid) IS 
'Returns uncalled leads assigned to a specific agent. Strictly filters by user_id to ensure agents only see their assigned leads.';

