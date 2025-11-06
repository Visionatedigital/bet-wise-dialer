-- Fix search_path for the new function
CREATE OR REPLACE FUNCTION get_agent_uncalled_leads(agent_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  score INTEGER,
  segment TEXT,
  priority TEXT,
  campaign TEXT,
  campaign_id UUID,
  last_activity TEXT,
  last_contact_at TIMESTAMPTZ,
  next_action TEXT,
  next_action_due TIMESTAMPTZ,
  intent TEXT,
  tags TEXT[],
  last_bet_date DATE,
  last_deposit_ugx NUMERIC,
  sla_minutes INTEGER,
  user_id UUID,
  assigned_at TIMESTAMPTZ,
  assigned_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT l.*
  FROM leads l
  WHERE l.user_id = agent_id
    AND NOT EXISTS (
      SELECT 1 
      FROM call_activities ca 
      WHERE ca.user_id = agent_id 
        AND ca.phone_number = l.phone
    )
  ORDER BY l.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;